import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window
import Qt.labs.platform 1.1 as Platform

ApplicationWindow {
    id: window

    // Guard against buggy desktopAvailable* values reported by some compositors.
    property int safeScreenWidth: {
        var w = Screen.desktopAvailableWidth > 0 ? Screen.desktopAvailableWidth : Screen.width
        return w > 0 ? w : 1366
    }
    property int safeScreenHeight: {
        var h = Screen.desktopAvailableHeight > 0 ? Screen.desktopAvailableHeight : Screen.height
        return h > 0 ? h : 768
    }

    width: Math.min(1180, safeScreenWidth * 0.9)
    height: Math.min(820, safeScreenHeight * 0.9)
    minimumWidth: Math.min(900, safeScreenWidth)
    minimumHeight: Math.min(620, safeScreenHeight)
    visible: true
    title: "Waddle"
    // Custom titlebar controls in QML.
    flags: Qt.FramelessWindowHint | Qt.Window
    color: "#0b111a"
    objectName: "waddle"

    property string displayFont: {
        if (Qt.platform.os === "linux") {
            return "SF Pro Display, San Francisco, Noto Sans, Sans Serif"
        }
        return "SF Pro Display, San Francisco, Sans Serif"
    }
    property string bodyFont: {
        if (Qt.platform.os === "linux") {
            return "SF Pro Text, SF Pro Display, Noto Sans, Sans Serif"
        }
        return "SF Pro Text, Sans Serif"
    }
    property string monoFont: {
        if (Qt.platform.os === "linux") {
            return "SF Mono, JetBrains Mono, Fira Code, Monospace"
        }
        return "SF Mono, Menlo, Monospace"
    }
    property int cornerRadius: 14
    property var theme: ({
        bgBase: "#0b111a",
        bgTop: "#121d2f",
        bgBottom: "#0a1322",
        panel: Qt.rgba(0.10, 0.16, 0.25, 0.76),
        panelSoft: Qt.rgba(0.13, 0.20, 0.31, 0.70),
        panelInset: Qt.rgba(0.07, 0.12, 0.21, 0.82),
        border: Qt.rgba(0.74, 0.84, 1.0, 0.22),
        borderStrong: Qt.rgba(0.78, 0.89, 1.0, 0.38),
        accent: "#4cc5ff",
        accentSoft: "#8fdcff",
        textPrimary: "#edf5ff",
        textSecondary: "#b8c6dc",
        textMuted: "#8ca0be"
    })
    property string missingCliNameSafe: (window.controller && window.controller.missingCliName) ? window.controller.missingCliName : ""
    property var controller: (typeof chatController !== "undefined") ? chatController : null
    property var starterCards: [
        { tag: "<>", title: "Write code", subtitle: "Clean, direct implementations.", prompt: "Write a clean implementation for this problem." },
        { tag: "Aa", title: "Refine text", subtitle: "Improve structure and clarity.", prompt: "Help me rewrite this text with better clarity." },
        { tag: "::", title: "Summarize", subtitle: "Short, objective bullet points.", prompt: "Summarize this content in short, objective bullet points." },
        { tag: "??", title: "Plan steps", subtitle: "Turn ideas into action.", prompt: "Help me organize this idea into clear next steps." }
    ]
    property real starDrift: 0
    property real cloudDrift: 0
    property real ambientPulse: 0
    property real introProgress: 0
    property string mascotState: controller ? controller.mascotState : "idle"
    property string mascotUrlBase: {
        if (!mascotUrl || mascotUrl.lastIndexOf("/") === -1) return ""
        return mascotUrl.substring(0, mascotUrl.lastIndexOf("/") + 1)
    }
    property bool mascotWalkingOut: false
    property bool mascotWalkingIn: false
    property real mascotWalkX: 0.5  // 0 = left edge, 0.5 = center, 1 = right edge
    property int mascotWalkFrame: 1
    // Blink animation properties
    property bool mascotBlinking: false
    property int mascotBlinkFrame: 0  // 0 = open, 1 = half-closed, 2 = closed
    property real nextBlinkTime: 2000  // Random time until next blink (ms)
    // Eye tracking properties (used for pupil movement)
    property real eyeOffsetX: 0  // Calculated eye offset
    property real eyeOffsetY: 0  // Calculated eye offset
    // Konami code easter egg
    property var konamiCode: ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]
    property int konamiIndex: 0
    property bool konamiUnlocked: false
    // Game easter egg mode
    property string gameMode: ""  // "", "gamer", "powerup", "pacman", "gameover"
    // Send button penguin reactions
    property bool sendPenguinJump: false
    property bool sendPenguinSpin: false
    // Animation configuration (centralized)
    property var animationConfig: ({
        walkDuration: 2000,
        blinkMinTime: 2000,
        blinkMaxTime: 6000,
        blinkFrameTime: 80,
        blinkHoldTime: 50,
        gameModeTimeout: 10000,
        sendPenguinReset: 1500,
        sendPenguinJumpHeight: -12,
        sendPenguinScale: 1.3
    })
    // Clipboard helper removed: use Qt.application.clipboard() directly when available

    function getMascotUrlForState(state) {
        // Game mode takes priority!
        var gameMascot = getGameModeMascot()
        if (gameMascot !== "") return gameMascot
        
        if (!controller) return mascotUrl
        // Map emotional states to SVG files
        var stateMap = {
            "idle": "",  // Use default time-based mascot
            "thinking": "waddle_8bit_thinking.svg",
            "typing": "waddle_8bit_typing.svg",
            "error": "waddle_8bit_error.svg",
            "success": "waddle_8bit_success.svg",
            "streaming": "waddle_8bit_streaming.svg"
        }
        var stateFile = stateMap[state]
        if (stateFile && stateFile !== "") {
            var basePath = mascotUrl.substring(0, mascotUrl.lastIndexOf("/") + 1)
            return basePath + stateFile
        }
        return mascotUrl
    }

    function getMascotBlinkUrl() {
        // Game mode takes priority!
        var gameMascot = getGameModeMascot()
        if (gameMascot !== "") return gameMascot
        
        var basePath = mascotUrl.substring(0, mascotUrl.lastIndexOf("/") + 1)
        if (mascotBlinkFrame === 2) {
            return basePath + "waddle_8bit_blink.svg"  // Closed
        } else if (mascotBlinkFrame === 1) {
            return basePath + "waddle_8bit_blink_half.svg"  // Half-closed
        }
        return getMascotUrlForState(mascotState)  // Open - use state image
    }

    function getMascotWalkUrl() {
        var basePath = mascotUrl.substring(0, mascotUrl.lastIndexOf("/") + 1)
        var frame = Math.max(1, Math.min(3, Math.round(mascotWalkFrame)))
        if (frame === 2) return basePath + "waddle_walk_2.svg"
        if (frame === 3) return basePath + "waddle_walk_3.svg"
        return basePath + "waddle_walk_1.svg"
    }

    function triggerBlink() {
        if (mascotBlinking || mascotWalkingOut || mascotWalkingIn) return
        mascotBlinking = true
        mascotBlinkFrame = 1  // Half-closed
        blinkTimer2.start()  // Go to closed
    }

    function updateEyeTracking(mouseX, mouseY) {
        // Calculate normalized cursor position relative to mascot center
        var mascotCenterX = window.width * 0.5
        var mascotCenterY = window.height * 0.7  // Mascot is at bottom

        // Normalize to -1 to 1 range
        var relX = (mouseX - mascotCenterX) / (window.width * 0.3)
        var relY = (mouseY - mascotCenterY) / (window.height * 0.3)

        // Clamp to reasonable range (-1 to 1)
        relX = Math.max(-1, Math.min(1, relX))
        relY = Math.max(-1, Math.min(1, relY))

        // Apply to eye offset (max 2 pixels movement)
        eyeOffsetX = relX * 2
        eyeOffsetY = relY * 2
    }

    function checkKonamiCode(key) {
        // Check if the key matches the current position in Konami code
        if (key === konamiCode[konamiIndex]) {
            konamiIndex++
            if (konamiIndex >= konamiCode.length) {
                // Konami code completed!
                konamiUnlocked = true
                konamiIndex = 0
                activateGameMode("powerup")
                return true
            }
        } else {
            // Reset if wrong key
            konamiIndex = (key === konamiCode[0]) ? 1 : 0
        }
        return false
    }

    function activateGameMode(mode) {
        gameMode = mode
        // Auto-reset after 10 seconds
        gameModeTimer.restart()
    }

    function getGameModeMascot() {
        if (gameMode === "gamer") return mascotUrlBase + "waddle_8bit_gamer.svg"
        if (gameMode === "powerup") return mascotUrlBase + "waddle_8bit_powerup.svg"
        if (gameMode === "pacman") return mascotUrlBase + "waddle_8bit_pacman.svg"
        if (gameMode === "gameover") return mascotUrlBase + "waddle_8bit_gameover.svg"
        return ""
    }
    function startWalkOut() {
        if (mascotWalkingOut || mascotWalkingIn) return
        mascotWalkingOut = true
        mascotWalkX = 0.5
        mascotWalkFrame = 1
        walkOutAnim.start()
    }

    function startWalkIn() {
        if (mascotWalkingOut || mascotWalkingIn) return
        mascotWalkingIn = true
        mascotWalkX = -0.2  // Start from off-screen left
        mascotWalkFrame = 1
        walkInAnim.start()
    }

    function triggerWalkOutIn() {
        // Walk out first, then walk in after a delay
        if (mascotWalkingOut || mascotWalkingIn) return
        startWalkOut()
        // After walk out completes (~2s), walk back in
        walkOutTimer.start()
    }

    function submitPrompt(rawText) {
        if (!window.controller) {
            return false
        }
        let text = (rawText || "").trim()
        if (text.length === 0) {
            return false
        }
        window.controller.sendPrompt(text)
        return true
    }

    // Timer to trigger walk-in after walk-out completes
    Timer {
        id: walkOutTimer
        interval: animationConfig.walkDuration + 200  // Buffer
        running: false
        repeat: false
        onTriggered: {
            startWalkIn()
        }
    }

    // Blink animation timers
    Timer {
        id: blinkTimer
        interval: nextBlinkTime
        running: true
        repeat: false
        onTriggered: {
            triggerBlink()
        }
    }

    Timer {
        id: blinkTimer2
        interval: animationConfig.blinkFrameTime
        running: false
        repeat: false
        onTriggered: {
            mascotBlinkFrame = 2  // Closed
            blinkTimer3.start()
        }
    }

    Timer {
        id: blinkTimer3
        interval: animationConfig.blinkHoldTime
        running: false
        repeat: false
        onTriggered: {
            mascotBlinkFrame = 1  // Half-closed
            blinkTimer4.start()
        }
    }

    Timer {
        id: blinkTimer4
        interval: animationConfig.blinkFrameTime
        running: false
        repeat: false
        onTriggered: {
            mascotBlinking = false
            mascotBlinkFrame = 0  // Open
            // Set next blink time (random between 2-6 seconds)
            nextBlinkTime = animationConfig.blinkMinTime + Math.random() * (animationConfig.blinkMaxTime - animationConfig.blinkMinTime)
            blinkTimer.start()
        }
    }

    // Game mode timer - auto reset after 10 seconds
    Timer {
        id: gameModeTimer
        interval: animationConfig.gameModeTimeout
        running: false
        repeat: false
        onTriggered: {
            gameMode = ""
        }
    }

    // Send button penguin reaction timer
    Timer {
        id: sendPenguinTimer
        interval: animationConfig.sendPenguinReset
        running: false
        repeat: false
        onTriggered: {
            sendPenguinJump = false
            sendPenguinSpin = false
        }
    }

    // Keyboard handler for Konami code and other easter eggs
    Item {
        id: keyboardHandler
        focus: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: {
            var keyName = event.key.toString()
            var ctrlPressed = event.modifiers & Qt.ControlModifier
            var shiftPressed = event.modifiers & Qt.ShiftModifier
            
            // Convert to lowercase for comparison
            if (keyName === "KeyA") keyName = "a"
            else if (keyName === "KeyB") keyName = "b"
            else if (keyName === "KeyG") keyName = "g"
            else if (keyName === "KeyP") keyName = "p"
            else if (keyName === "KeyM") keyName = "m"
            else if (keyName === "KeyX") keyName = "x"
            else if (keyName === "ArrowUp") keyName = "ArrowUp"
            else if (keyName === "ArrowDown") keyName = "ArrowDown"
            else if (keyName === "ArrowLeft") keyName = "ArrowLeft"
            else if (keyName === "ArrowRight") keyName = "ArrowRight"
            
            // Konami code check
            checkKonamiCode(keyName)
            
            // Secret shortcuts:
            // Ctrl+Shift+G = Gamer mode
            if (ctrlPressed && shiftPressed && keyName === "g") {
                activateGameMode("gamer")
            }
            // Ctrl+Shift+P = Power-up mode
            else if (ctrlPressed && shiftPressed && keyName === "p") {
                activateGameMode("powerup")
            }
            // Ctrl+Shift+M = Pac-Man mode
            else if (ctrlPressed && shiftPressed && keyName === "m") {
                activateGameMode("pacman")
            }
            // Ctrl+Shift+X = Game Over mode (RIP)
            else if (ctrlPressed && shiftPressed && keyName === "x") {
                activateGameMode("gameover")
            }
        }
    }

    // Connect controller walk animation trigger
    Connections {
        target: controller
        function onWalkAnimationTriggered() {
            triggerWalkOutIn()
        }
    }

    component IconBadge: Rectangle {
        id: iconBadge

        property string label: ""
        property color fillColor: theme.accent
        property color textColor: theme.textPrimary

        implicitWidth: 32
        implicitHeight: 32
        radius: cornerRadius * 0.45
        color: fillColor
        border.width: 1
        border.color: Qt.rgba(1, 1, 1, 0.16)

        Text {
            anchors.centerIn: parent
            text: iconBadge.label
            color: iconBadge.textColor
            font.pixelSize: 12
            font.weight: Font.DemiBold
            font.family: window.displayFont
        }
    }

    component CapsuleButton: Rectangle {
        id: capsuleButton

        property string label: ""
        property string tag: ""
        property bool active: false
        property bool primary: false
        property string sizeTier: primary ? "primary" : "regular"
        property bool quiet: false
        property bool pulse: false
        property real pulseScale: 1.0
        property real shimmerProgress: 0.0
        property bool emphasized: primary || active
        signal clicked()

        property int minChipWidth: sizeTier === "command" ? 78 : (sizeTier === "primary" ? 108 : 88)
        implicitWidth: Math.max(buttonRow.implicitWidth + (sizeTier === "command" ? 14 : 18), minChipWidth)
        implicitHeight: sizeTier === "command" ? 30 : (sizeTier === "primary" ? 36 : 34)
        radius: cornerRadius + 4
        color: !enabled
            ? Qt.rgba(theme.panelInset.r, theme.panelInset.g, theme.panelInset.b, 0.70)
            : primary
                ? theme.accent
                : active
                    ? Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.22)
                    : buttonArea.containsMouse
                        ? Qt.lighter(quiet ? theme.panelInset : theme.panelSoft, quiet ? 1.08 : 1.16)
                        : quiet
                            ? Qt.rgba(theme.panelInset.r, theme.panelInset.g, theme.panelInset.b, 0.86)
                            : Qt.rgba(theme.panelSoft.r, theme.panelSoft.g, theme.panelSoft.b, 0.92)
        border.width: 1
        border.color: primary
            ? theme.accentSoft
            : active
                ? theme.borderStrong
                : quiet
                    ? Qt.rgba(theme.border.r, theme.border.g, theme.border.b, 0.72)
                    : theme.border
        opacity: enabled ? 1.0 : 0.5
        scale: (buttonArea.pressed ? 0.98 : (buttonArea.containsMouse ? 1.015 : 1.0)) * pulseScale
        clip: true

        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: "transparent"
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(1, 1, 1, capsuleButton.primary ? 0.22 : 0.08) }
                GradientStop { position: 1.0; color: Qt.rgba(1, 1, 1, 0.00) }
            }
        }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 1
            height: Math.max(8, parent.height * 0.32)
            radius: parent.radius
            color: Qt.rgba(1, 1, 1, capsuleButton.primary ? 0.16 : (capsuleButton.quiet ? 0.03 : 0.05))
            visible: capsuleButton.enabled
        }

        Rectangle {
            anchors.fill: parent
            anchors.margins: -1
            radius: parent.radius + 1
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(theme.accentSoft.r, theme.accentSoft.g, theme.accentSoft.b, 0.42)
            opacity: capsuleButton.emphasized ? (buttonArea.containsMouse ? 1.0 : 0.72) : 0.0

            Behavior on opacity {
                NumberAnimation { duration: 140 }
            }
        }

        Rectangle {
            id: buttonShimmer
            width: Math.max(18, parent.width * 0.42)
            height: parent.height * 1.7
            y: -parent.height * 0.34
            x: -width + (parent.width + width * 2) * capsuleButton.shimmerProgress
            radius: Math.max(8, width * 0.18)
            rotation: -18
            color: Qt.rgba(1, 1, 1, capsuleButton.primary ? 0.26 : 0.18)
            opacity: buttonArea.containsMouse && capsuleButton.enabled ? 0.45 : 0.0

            Behavior on opacity {
                NumberAnimation { duration: 140 }
            }
        }

        SequentialAnimation on pulseScale {
            running: capsuleButton.pulse && capsuleButton.enabled && !buttonArea.containsMouse && !buttonArea.pressed
            loops: Animation.Infinite
            NumberAnimation { to: 1.03; duration: 520; easing.type: Easing.InOutSine }
            NumberAnimation { to: 1.0; duration: 520; easing.type: Easing.InOutSine }
        }

        NumberAnimation on shimmerProgress {
            running: capsuleButton.enabled && buttonArea.containsMouse
            from: 0
            to: 1
            duration: 920
            loops: Animation.Infinite
            easing.type: Easing.OutCubic
        }

        Behavior on scale {
            NumberAnimation { duration: 80 }
        }

        Behavior on color {
            ColorAnimation { duration: 120 }
        }

        Behavior on border.color {
            ColorAnimation { duration: 120 }
        }

        Behavior on opacity {
            NumberAnimation { duration: 120 }
        }

        MouseArea {
            id: buttonArea
            anchors.fill: parent
            enabled: capsuleButton.enabled
            hoverEnabled: true
            cursorShape: capsuleButton.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: capsuleButton.clicked()
        }

        RowLayout {
            id: buttonRow
            anchors.centerIn: parent
            spacing: 8

            Rectangle {
                visible: capsuleButton.tag.length > 0
                implicitWidth: 18
                implicitHeight: 18
                radius: 9
                color: capsuleButton.primary
                    ? Qt.rgba(1, 1, 1, 0.36)
                    : capsuleButton.active
                        ? Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.30)
                        : Qt.rgba(1, 1, 1, capsuleButton.quiet ? 0.10 : 0.16)
                border.width: 0

                Text {
                    anchors.centerIn: parent
                    text: capsuleButton.tag
                    color: capsuleButton.primary ? "#123348" : theme.textPrimary
                    font.pixelSize: 9
                    font.weight: Font.Bold
                    font.family: window.displayFont
                }
            }

            Text {
                text: capsuleButton.label
                color: capsuleButton.primary ? "#0b1a28" : (capsuleButton.active ? theme.textPrimary : (capsuleButton.quiet ? theme.textMuted : theme.textSecondary))
                font.pixelSize: sizeTier === "command" ? 11 : 12
                font.weight: Font.DemiBold
                font.family: window.bodyFont
            }
        }
    }

    component BackendSegmentedControl: Rectangle {
        id: backendSwitch

        property string value: "codex"
        signal selected(string key)

        implicitWidth: Math.max(142, pickerRow.implicitWidth + 16)
        implicitHeight: 34
        radius: cornerRadius + 4
        color: pickerArea.pressed
            ? Qt.lighter(theme.panelInset, 1.08)
            : (pickerArea.containsMouse || backendPopup.visible)
                ? Qt.lighter(theme.panelInset, 1.14)
                : Qt.rgba(theme.panelInset.r, theme.panelInset.g, theme.panelInset.b, 0.86)
        border.width: 1
        border.color: pickerArea.containsMouse || backendPopup.visible ? theme.borderStrong : theme.border
        opacity: enabled ? 1.0 : 0.55
        scale: pickerArea.pressed ? 0.985 : (pickerArea.containsMouse ? 1.015 : 1.0)

        Behavior on color {
            ColorAnimation { duration: 130 }
        }

        Behavior on border.color {
            ColorAnimation { duration: 130 }
        }

        Behavior on scale {
            NumberAnimation { duration: 110; easing.type: Easing.OutQuad }
        }

        RowLayout {
            id: pickerRow
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            Rectangle {
                implicitWidth: 18
                implicitHeight: 18
                radius: 9
                color: Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.26)

                Text {
                    anchors.centerIn: parent
                    text: backendSwitch.value === "codex" ? "C" : "Q"
                    color: theme.textPrimary
                    font.pixelSize: 9
                    font.weight: Font.Bold
                    font.family: window.displayFont
                }
            }

            Text {
                text: backendSwitch.value === "codex" ? "Codex" : "Qwen"
                color: theme.textPrimary
                font.pixelSize: 12
                font.weight: Font.DemiBold
                font.family: window.bodyFont
            }

            Item { Layout.fillWidth: true }

            Text {
                text: "▾"
                color: theme.textSecondary
                font.pixelSize: 11
                font.weight: Font.DemiBold
                font.family: window.bodyFont
            }
        }

        MouseArea {
            id: pickerArea
            anchors.fill: parent
            enabled: backendSwitch.enabled
            hoverEnabled: true
            cursorShape: backendSwitch.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: {
                var p = backendSwitch.mapToItem(window.contentItem, 0, 0)
                backendPopup.x = p.x
                backendPopup.y = Math.max(8, p.y - backendPopup.implicitHeight - 8)
                backendPopup.open()
            }
        }

        Popup {
            id: backendPopup
            parent: window.contentItem
            modal: false
            focus: true
            z: 9999
            width: backendSwitch.width
            padding: 6
            closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
            background: Rectangle {
                color: Qt.rgba(theme.panelInset.r, theme.panelInset.g, theme.panelInset.b, 0.96)
                border.width: 1
                border.color: theme.borderStrong
                radius: cornerRadius
            }

            contentItem: ColumnLayout {
                spacing: 4

                Repeater {
                    model: [
                        { key: "codex", label: "Codex" },
                        { key: "qwen", label: "Qwen" }
                    ]

                    Rectangle {
                        required property var modelData
                        property bool isActive: backendSwitch.value === modelData.key

                        Layout.fillWidth: true
                        implicitHeight: 32
                        radius: 10
                        color: optionArea.pressed
                            ? Qt.lighter(theme.panelSoft, 1.08)
                            : optionArea.containsMouse
                                ? Qt.lighter(theme.panelSoft, 1.16)
                                : isActive
                                    ? Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.20)
                                    : Qt.rgba(theme.panelSoft.r, theme.panelSoft.g, theme.panelSoft.b, 0.80)
                        border.width: 1
                        border.color: isActive ? theme.accentSoft : theme.border

                        Behavior on color {
                            ColorAnimation { duration: 120 }
                        }

                        Behavior on border.color {
                            ColorAnimation { duration: 120 }
                        }

                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 8

                            Text {
                                text: isActive ? "•" : ""
                                color: theme.accentSoft
                                font.pixelSize: 11
                                font.weight: Font.DemiBold
                                font.family: window.bodyFont
                            }

                            Text {
                                text: modelData.label
                                color: theme.textPrimary
                                font.pixelSize: 12
                                font.weight: Font.DemiBold
                                font.family: window.bodyFont
                            }

                            Item { Layout.fillWidth: true }
                        }

                        MouseArea {
                            id: optionArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                backendSwitch.selected(modelData.key)
                                backendPopup.close()
                            }
                        }
                    }
                }
            }
        }
    }

    component WindowButton: Rectangle {
        id: windowButton

        property string label: ""
        property color baseColor: theme.panelSoft
        property color hoverColor: Qt.lighter(theme.panelSoft, 1.16)
        property color pressColor: Qt.lighter(theme.panelSoft, 1.24)
        property color textColor: theme.textPrimary
        property color borderColor: theme.border
        signal clicked()

        width: 26
        height: 20
        radius: 10
        color: buttonArea.pressed ? pressColor : (buttonArea.containsMouse ? hoverColor : baseColor)
        border.width: 1
        border.color: borderColor

        Behavior on color {
            ColorAnimation { duration: 120 }
        }

        Behavior on border.color {
            ColorAnimation { duration: 120 }
        }

        MouseArea {
            id: buttonArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: windowButton.clicked()
        }

        Text {
            anchors.centerIn: parent
            text: windowButton.label
            color: windowButton.textColor
            font.pixelSize: 11
            font.weight: Font.DemiBold
            font.family: window.bodyFont
        }
    }

    NumberAnimation on starDrift {
        id: starDriftAnim
        from: 0
        to: Math.max(120, window.height * 1.5)
        duration: 15000
        loops: Animation.Infinite
        running: true
        easing.type: Easing.Linear
    }

    NumberAnimation on cloudDrift {
        id: cloudDriftAnim
        from: 0
        to: Math.max(240, window.width * 1.2)
        duration: 45000
        loops: Animation.Infinite
        running: true
        easing.type: Easing.Linear
    }

    NumberAnimation on ambientPulse {
        id: ambientPulseAnim
        from: 0
        to: 1
        duration: 7200
        loops: Animation.Infinite
        running: true
        easing.type: Easing.InOutSine
    }

    NumberAnimation on introProgress {
        id: introAnim
        from: 0
        to: 1
        duration: 560
        easing.type: Easing.OutCubic
    }

    // Keep walk sprite frames cycling while mascot is moving.
    SequentialAnimation {
        id: walkOutFrameAnim
        running: window.mascotWalkingOut
        loops: Animation.Infinite

        NumberAnimation {
            target: window
            property: "mascotWalkFrame"
            from: 1
            to: 3
            duration: 330
            easing.type: Easing.Linear
        }
        NumberAnimation {
            target: window
            property: "mascotWalkFrame"
            from: 3
            to: 1
            duration: 330
            easing.type: Easing.Linear
        }
    }

    SequentialAnimation {
        id: walkInFrameAnim
        running: window.mascotWalkingIn
        loops: Animation.Infinite

        NumberAnimation {
            target: window
            property: "mascotWalkFrame"
            from: 1
            to: 3
            duration: 330
            easing.type: Easing.Linear
        }
        NumberAnimation {
            target: window
            property: "mascotWalkFrame"
            from: 3
            to: 1
            duration: 330
            easing.type: Easing.Linear
        }
    }

    // Walk out animation - mascot walks from center to right edge
    ParallelAnimation {
        id: walkOutAnim
        running: false

        // Move mascot horizontally
        NumberAnimation {
            id: walkOutMove
            target: window
            property: "mascotWalkX"
            from: 0.5
            to: 1.2  // Walk past right edge
            duration: animationConfig.walkDuration
            easing.type: Easing.InOutQuad
        }
        onFinished: {
            window.mascotWalkingOut = false
            window.mascotWalkingIn = false
            window.mascotWalkX = 0.5  // Reset to center
            window.mascotWalkFrame = 1
            walkOutAnim.stop()
        }
    }

    // Walk in animation - mascot walks from left edge to center
    ParallelAnimation {
        id: walkInAnim
        running: false

        // Move mascot horizontally
        NumberAnimation {
            id: walkInMove
            target: window
            property: "mascotWalkX"
            from: -0.2  // Start from off-screen left
            to: 0.5
            duration: animationConfig.walkDuration
            easing.type: Easing.OutQuad
        }
        onFinished: {
            window.mascotWalkingIn = false
            window.mascotWalkingOut = false
            window.mascotWalkX = 0.5  // Reset to center
            window.mascotWalkFrame = 1
            walkInAnim.stop()
        }
    }

    // Cleanup on window close
    Component.onDestruction: {
        blinkTimer.stop()
        blinkTimer2.stop()
        blinkTimer3.stop()
        blinkTimer4.stop()
        gameModeTimer.stop()
        sendPenguinTimer.stop()
        walkOutTimer.stop()
        walkOutFrameAnim.stop()
        walkOutAnim.stop()
        walkInFrameAnim.stop()
        walkInAnim.stop()
        footTapAnimation.stop()
    }

    component StatusBadge: Rectangle {
        id: statusBadge

        property string tone: "idle"
        property string label: ""
        property color accentColor: tone === "error"
            ? "#ff7474"
            : tone === "starting"
                ? "#f2c778"
                : theme.accent
        property color fillColor: tone === "error"
            ? Qt.rgba(0.35, 0.15, 0.17, 0.65)
            : tone === "starting"
                ? Qt.rgba(0.30, 0.23, 0.13, 0.65)
                : theme.panelInset
        property color lightColor: accentColor

        implicitWidth: statusRow.implicitWidth + 20
        implicitHeight: 30
        radius: cornerRadius
        color: fillColor
        border.width: 1
        border.color: tone === "ready" ? theme.borderStrong : accentColor

        Behavior on color {
            ColorAnimation { duration: 180 }
        }

        Behavior on border.color {
            ColorAnimation { duration: 180 }
        }

        RowLayout {
            id: statusRow
            anchors.centerIn: parent
            spacing: 8

            // Loading spinner for "starting" state
            Rectangle {
                id: spinnerContainer
                visible: statusBadge.tone === "starting"
                width: 14
                height: 14
                radius: 7
                color: "transparent"
                border.width: 2
                border.color: lightColor

                Rectangle {
                    id: spinnerDot
                    anchors.top: parent.top
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.topMargin: -2
                    width: 6
                    height: 6
                    radius: 3
                    color: lightColor
                }

                RotationAnimator {
                    id: spinnerAnimator
                    target: spinnerContainer
                    from: 0
                    to: 360
                    duration: 1000
                    loops: Animation.Infinite
                    running: spinnerContainer.visible
                }
            }

            // Status light for idle/ready/error
            Rectangle {
                id: statusLight
                visible: statusBadge.tone !== "starting"
                width: 8
                height: 8
                radius: 4
                color: lightColor

                Behavior on color {
                    ColorAnimation { duration: 180 }
                }

                SequentialAnimation on opacity {
                    running: statusBadge.tone !== "starting"
                    loops: Animation.Infinite
                    NumberAnimation {
                        to: statusBadge.tone === "error" ? 0.2 : 0.35
                        duration: statusBadge.tone === "error" ? 260 : 420
                    }
                    NumberAnimation {
                        to: 1.0
                        duration: statusBadge.tone === "error" ? 260 : 420
                    }
                }

                SequentialAnimation on scale {
                    running: statusBadge.tone !== "starting"
                    loops: Animation.Infinite
                    NumberAnimation {
                        to: statusBadge.tone === "error" ? 0.9 : 0.82
                        duration: statusBadge.tone === "error" ? 260 : 420
                    }
                    NumberAnimation {
                        to: 1.0
                        duration: statusBadge.tone === "error" ? 260 : 420
                    }
                }
            }

            Text {
                text: statusBadge.label
                color: theme.textPrimary
                font.pixelSize: 11
                font.weight: Font.DemiBold
                font.family: window.bodyFont
            }
        }
    }

    component StarterCard: Rectangle {
        id: starterCard

        property string tag: ""
        property string title: ""
        property string subtitle: ""
        property int revealIndex: 0
        property real introProgress: 0
        signal clicked()

        radius: cornerRadius + 6
        color: cardArea.containsMouse ? Qt.lighter(theme.panelSoft, 1.08) : theme.panelSoft
        border.width: 1
        border.color: cardArea.containsMouse ? theme.borderStrong : theme.border
        scale: (cardArea.pressed ? 0.98 : (cardArea.containsMouse ? 1.015 : 1.0)) * (0.95 + introProgress * 0.05)
        opacity: introProgress
        clip: true

        Behavior on scale {
            NumberAnimation { duration: 110; easing.type: Easing.OutQuad }
        }

        Behavior on color {
            ColorAnimation { duration: 120 }
        }

        Behavior on border.color {
            ColorAnimation { duration: 120 }
        }

        SequentialAnimation on introProgress {
            running: true
            loops: 1
            PauseAnimation { duration: 110 + (starterCard.revealIndex * 70) }
            NumberAnimation { to: 1; duration: 360; easing.type: Easing.OutCubic }
        }

        MouseArea {
            id: cardArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: starterCard.clicked()
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 10

            IconBadge {
                label: starterCard.tag
                fillColor: theme.accent
                textColor: theme.textPrimary
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4

                Text {
                    text: starterCard.title
                    color: theme.textPrimary
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }

                Text {
                    Layout.fillWidth: true
                    text: starterCard.subtitle
                    color: theme.textSecondary
                    font.pixelSize: 11
                    wrapMode: Text.WordWrap
                    maximumLineCount: 2
                    elide: Text.ElideRight
                    font.family: window.bodyFont
                }
            }
        }
    }

    component ChatHeader: Rectangle {
        id: chatHeader

        property var controller
        property var themeObj
        property int cornerRadius: 14
        property string displayFont: "Sans Serif"
        property string bodyFont: "Sans Serif"
        property real introProgress: 1.0
        property real windowWidth: 0
        property bool maximized: false

        signal startMove(var mouse)
        signal openPreferences()
        signal cycleMascot()
        signal minimizeRequested()
        signal toggleMaximizeRequested()
        signal closeRequested()

        Layout.fillWidth: true
        implicitHeight: 54
        radius: cornerRadius + 4
        color: themeObj.panel
        border.width: 1
        border.color: themeObj.border
        opacity: 0.62 + (0.38 * introProgress)
        scale: 0.985 + (0.015 * introProgress)

        RowLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            IconBadge {
                label: "W"
                fillColor: chatHeader.themeObj.accent
            }

            ColumnLayout {
                spacing: 2

                Text {
                    text: "Waddle"
                    color: chatHeader.themeObj.textPrimary
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    font.family: chatHeader.displayFont
                }

                Text {
                    text: "Native chat for Codex and Qwen"
                    color: chatHeader.themeObj.textMuted
                    font.pixelSize: 10
                    font.family: chatHeader.bodyFont
                    visible: chatHeader.windowWidth >= 940
                }
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                MouseArea {
                    anchors.fill: parent
                    acceptedButtons: Qt.LeftButton
                    hoverEnabled: true
                    cursorShape: Qt.SizeAllCursor
                    onPressed: function(mouse) {
                        chatHeader.startMove(mouse)
                    }
                }
            }

            CapsuleButton {
                label: "Chat"
                tag: "•"
                active: true
                enabled: false
                visible: chatHeader.windowWidth >= 1080
            }

            StatusBadge {
                label: chatHeader.controller ? chatHeader.controller.statusTitle : "Loading"
                tone: chatHeader.controller ? chatHeader.controller.bridgeStatus : "idle"
            }

            CapsuleButton {
                label: chatHeader.controller ? chatHeader.controller.currentBackendLabel : "CLI"
                tag: chatHeader.controller && chatHeader.controller.currentBackendLabel === "Codex" ? "C" : "Q"
                active: true
                enabled: false
                visible: chatHeader.windowWidth >= 1000
            }

            CapsuleButton {
                label: "Mascot"
                tag: "~"
                enabled: true
                visible: chatHeader.windowWidth >= 920
                onClicked: chatHeader.cycleMascot()
            }

            CapsuleButton {
                label: "Preferences"
                tag: "⚙"
                enabled: true
                onClicked: chatHeader.openPreferences()
            }

            RowLayout {
                spacing: 6

                WindowButton {
                    label: "–"
                    onClicked: chatHeader.minimizeRequested()
                }

                WindowButton {
                    label: chatHeader.maximized ? "❐" : "▢"
                    onClicked: chatHeader.toggleMaximizeRequested()
                }

                WindowButton {
                    label: "×"
                    baseColor: "#3a1a1f"
                    hoverColor: "#5a1f27"
                    pressColor: "#7a2430"
                    textColor: "#ffe4e6"
                    borderColor: "#8b1e35"
                    onClicked: chatHeader.closeRequested()
                }
            }
        }
    }

    component MessageBubble: Item {
        id: messageBubble

        required property string role
        required property string content
        required property string meta
        property var themeObj
        property int cornerRadius: 14
        property string bodyFont: "Sans Serif"
        signal copyRequested(string text)

        width: ListView.view ? ListView.view.width : 0
        implicitHeight: bubbleBox.implicitHeight + 12

        Rectangle {
            id: bubbleBox
            width: Math.min(parent.width * 0.76, 760)
            implicitHeight: bubbleColumn.implicitHeight + 24
            anchors.right: messageBubble.role === "user" ? parent.right : undefined
            anchors.left: messageBubble.role === "user" ? undefined : parent.left
            radius: messageBubble.cornerRadius + 2
            color: messageBubble.role === "user"
                ? Qt.lighter(messageBubble.themeObj.panelSoft, 1.08)
                : messageBubble.role === "system"
                    ? messageBubble.themeObj.panelSoft
                    : messageBubble.themeObj.panelInset
            border.width: 1
            border.color: messageBubble.role === "user"
                ? Qt.rgba(messageBubble.themeObj.accent.r, messageBubble.themeObj.accent.g, messageBubble.themeObj.accent.b, 0.42)
                : messageBubble.role === "system"
                    ? messageBubble.themeObj.borderStrong
                    : messageBubble.themeObj.border

            RowLayout {
                id: bubbleColumn
                anchors.fill: parent
                anchors.margins: 14
                spacing: 10

                IconBadge {
                    label: messageBubble.role === "user" ? "U" : (messageBubble.role === "system" ? "!" : "A")
                    fillColor: messageBubble.role === "user" ? messageBubble.themeObj.accentSoft : messageBubble.themeObj.accent
                    textColor: messageBubble.role === "user" ? "#133046" : messageBubble.themeObj.textPrimary
                    Layout.alignment: Qt.AlignTop
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 6

                    Text {
                        text: messageBubble.role === "user" ? "You" : (messageBubble.meta.length > 0 ? messageBubble.meta : "Agent")
                        color: messageBubble.themeObj.textMuted
                        font.pixelSize: 11
                        font.weight: Font.Medium
                        font.family: messageBubble.bodyFont
                    }

                    Text {
                        visible: messageBubble.role === "user"
                        Layout.fillWidth: true
                        text: messageBubble.content
                        color: messageBubble.themeObj.textPrimary
                        font.pixelSize: 13
                        wrapMode: Text.Wrap
                        font.family: messageBubble.bodyFont
                    }

                    TextEdit {
                        id: messageBody
                        visible: messageBubble.role !== "user"
                        Layout.fillWidth: true
                        text: messageBubble.content
                        color: messageBubble.themeObj.textPrimary
                        font.pixelSize: 13
                        font.family: messageBubble.bodyFont
                        wrapMode: TextEdit.Wrap
                        textFormat: TextEdit.RichText
                        readOnly: true
                        selectionColor: messageBubble.themeObj.accent
                        selectedTextColor: "#ffffff"
                    }
                }
            }

            MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.RightButton
                onClicked: function(mouse) {
                    if (mouse.button === Qt.RightButton) {
                        copyMenu.popup()
                    }
                }
            }

            Menu {
                id: copyMenu

                MenuItem {
                    text: "Copy text"
                    onTriggered: {
                        var plain = messageBubble.role === "user"
                            ? messageBubble.content
                            : messageBody.getText(0, messageBody.length)
                        messageBubble.copyRequested(plain)
                    }
                }
            }
        }
    }

    component ChatMessageList: ListView {
        id: messageList

        property var controller
        property var themeObj
        property int cornerRadius: 14
        property string bodyFont: "Sans Serif"
        property bool autoFollow: true
        property int followThreshold: 88
        signal copyRequested(string text)

        function isNearBottom() {
            return (contentHeight - (contentY + height)) <= followThreshold
        }

        function followLatest(force) {
            if (count <= 0) {
                return
            }
            if (!force && !autoFollow && !isNearBottom()) {
                return
            }
            Qt.callLater(function() {
                if (count > 0) {
                    positionViewAtEnd()
                }
            })
        }

        model: controller ? controller.messagesModel : null
        spacing: 14
        clip: true
        visible: count > 1
        boundsBehavior: Flickable.StopAtBounds
        add: Transition {
            ParallelAnimation {
                NumberAnimation { property: "opacity"; from: 0.0; to: 1.0; duration: 220; easing.type: Easing.OutQuad }
                NumberAnimation { property: "scale"; from: 0.97; to: 1.0; duration: 220; easing.type: Easing.OutCubic }
            }
        }

        delegate: MessageBubble {
            role: model.role
            content: model.content
            meta: model.meta
            themeObj: messageList.themeObj
            cornerRadius: messageList.cornerRadius
            bodyFont: messageList.bodyFont
            onCopyRequested: messageList.copyRequested(text)
        }

        ScrollBar.vertical: ScrollBar {
            policy: ScrollBar.AsNeeded
        }

        onCountChanged: followLatest(false)
        onContentHeightChanged: followLatest(false)
        onMovementEnded: autoFollow = isNearBottom()
        onFlickEnded: autoFollow = isNearBottom()
        Component.onCompleted: followLatest(true)
    }

    component ChatComposer: ColumnLayout {
        id: chatComposerRoot

        property var controller
        property var themeObj
        property int cornerRadius: 14
        property string bodyFont: "Sans Serif"
        property string mascotState: "idle"
        property string mascotUrl: ""
        property string gameMode: ""
        property var animationConfig: ({})
        property var mascotStateResolver
        property alias promptText: promptInput.text
        property string composerState: {
            if (!controller || controller.bridgeStatus === "starting") {
                return "connecting"
            }
            if (controller.bridgeStatus === "error") {
                return "error"
            }
            if (controller.awaitingResponse) {
                return "sending"
            }
            return "ready"
        }

        signal sendPrompt(string text)
        signal connectRequested()
        signal stopRequested()
        signal quickCommand(string command)
        signal backendSelected(string key)
        signal cycleMascot()

        function focusPrompt() {
            promptInput.forceActiveFocus()
        }

        function submitCurrentPrompt() {
            var payload = promptInput.text
            if (!payload || payload.trim().length === 0) {
                return
            }
            sendPrompt(payload)
            promptInput.text = ""
            promptInput.forceActiveFocus()
        }

        function stateLabel() {
            if (composerState === "connecting") {
                return "Connecting..."
            }
            if (composerState === "sending") {
                return "Sending..."
            }
            if (composerState === "error") {
                return "Connection error"
            }
            return "Ready"
        }

        Layout.fillWidth: true
        Layout.fillHeight: false
        Layout.minimumHeight: 176
        Layout.preferredHeight: 176
        Layout.maximumHeight: 176
        spacing: 8

        property bool sendPenguinJump: false
        property bool sendPenguinSpin: false

        Timer {
            id: sendPenguinTimerLocal
            interval: chatComposerRoot.animationConfig.sendPenguinReset || 1500
            running: false
            repeat: false
            onTriggered: {
                chatComposerRoot.sendPenguinJump = false
                chatComposerRoot.sendPenguinSpin = false
            }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            BackendSegmentedControl {
                value: chatComposerRoot.controller ? chatComposerRoot.controller.selectedBackend : "codex"
                enabled: !!chatComposerRoot.controller
                onSelected: function(key) {
                    chatComposerRoot.backendSelected(key)
                }
            }

            CapsuleButton {
                label: chatComposerRoot.controller && chatComposerRoot.controller.bridgeStatus === "ready" ? "Reconnect" : "Connect"
                tag: ">"
                primary: chatComposerRoot.controller ? chatComposerRoot.controller.needsReconnect : false
                sizeTier: "primary"
                pulse: chatComposerRoot.controller && chatComposerRoot.controller.bridgeStatus !== "ready"
                enabled: !!chatComposerRoot.controller && chatComposerRoot.controller.bridgeStatus !== "starting"
                onClicked: chatComposerRoot.connectRequested()
            }

            CapsuleButton {
                label: "Stop"
                tag: "[]"
                sizeTier: "command"
                quiet: true
                enabled: chatComposerRoot.controller && chatComposerRoot.controller.canStop
                onClicked: chatComposerRoot.stopRequested()
            }

            CapsuleButton {
                label: "/model"
                tag: ""
                sizeTier: "command"
                quiet: true
                enabled: chatComposerRoot.controller && chatComposerRoot.controller.canSend
                onClicked: chatComposerRoot.quickCommand("/model")
            }

            CapsuleButton {
                label: "/reset"
                tag: ""
                sizeTier: "command"
                quiet: true
                enabled: chatComposerRoot.controller && chatComposerRoot.controller.canSend
                onClicked: chatComposerRoot.quickCommand("/reset")
            }

            Item { Layout.fillWidth: true }

            Item {
                id: miniMascotContainer
                width: 24
                height: 24
                property real bobPhase: 0
                scale: 1.0 + Math.sin(bobPhase * 6.28318530718) * 0.06
                rotation: Math.sin((bobPhase * 6.28318530718) + 1.2) * 4

                NumberAnimation on bobPhase {
                    from: 0
                    to: 1
                    duration: 2500
                    loops: Animation.Infinite
                    running: true
                    easing.type: Easing.InOutSine
                }

                Image {
                    id: miniMascotImage
                    anchors.fill: parent
                    source: chatComposerRoot.mascotStateResolver
                        ? chatComposerRoot.mascotStateResolver(chatComposerRoot.mascotState)
                        : chatComposerRoot.mascotUrl
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    visible: source.toString().length > 0
                }

                Text {
                    anchors.centerIn: parent
                    text: "🐧"
                    font.pixelSize: 16
                    visible: !miniMascotImage.visible
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    enabled: !!chatComposerRoot.controller
                    onClicked: chatComposerRoot.cycleMascot()
                }
            }

            Text {
                text: "Press Enter to send · " + chatComposerRoot.stateLabel()
                color: chatComposerRoot.composerState === "error"
                    ? "#fda4af"
                    : chatComposerRoot.themeObj.textMuted
                font.pixelSize: 9
                font.family: chatComposerRoot.bodyFont
            }
        }

        Rectangle {
            id: promptBox
            Layout.fillWidth: true
            Layout.fillHeight: false
            Layout.minimumHeight: 108
            Layout.preferredHeight: 138
            radius: chatComposerRoot.cornerRadius + 4
            color: chatComposerRoot.themeObj.panelInset
            border.width: 1
            border.color: chatComposerRoot.composerState === "error"
                ? "#ef4444"
                : chatComposerRoot.composerState === "connecting"
                    ? "#f2c778"
                    : promptInput.activeFocus
                        ? chatComposerRoot.themeObj.borderStrong
                        : chatComposerRoot.themeObj.border
            property real focusGlow: promptInput.activeFocus ? 1.0 : 0.0
            scale: promptInput.activeFocus ? 1.004 : 1.0

            Behavior on border.color {
                ColorAnimation { duration: 140 }
            }

            Behavior on scale {
                NumberAnimation { duration: 140; easing.type: Easing.OutQuad }
            }

            Behavior on focusGlow {
                NumberAnimation { duration: 160; easing.type: Easing.OutQuad }
            }

            Rectangle {
                anchors.fill: parent
                radius: parent.radius
                color: Qt.rgba(
                    chatComposerRoot.themeObj.accent.r,
                    chatComposerRoot.themeObj.accent.g,
                    chatComposerRoot.themeObj.accent.b,
                    0.06 * promptBox.focusGlow
                )
            }

            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 8

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 8

                    TextArea {
                        id: promptInput
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        wrapMode: TextEdit.Wrap
                        placeholderText: chatComposerRoot.controller ? chatComposerRoot.controller.composerPlaceholder : "Start the conversation..."
                        placeholderTextColor: chatComposerRoot.themeObj.textMuted
                        color: chatComposerRoot.themeObj.textPrimary
                        selectionColor: chatComposerRoot.themeObj.accentSoft
                        font.pixelSize: 14
                        font.family: chatComposerRoot.bodyFont
                        padding: 0
                        enabled: chatComposerRoot.controller && chatComposerRoot.controller.canSend

                        background: Rectangle { color: "transparent" }

                        Keys.onPressed: function(event) {
                            if ((event.key === Qt.Key_Return || event.key === Qt.Key_Enter)
                                    && !(event.modifiers & Qt.ShiftModifier)) {
                                event.accepted = true
                                chatComposerRoot.submitCurrentPrompt()
                            }
                        }

                        Component.onCompleted: forceActiveFocus()
                    }

                    Text {
                        Layout.fillWidth: true
                        text: chatComposerRoot.controller ? chatComposerRoot.controller.statusDescription : "Loading controller..."
                        color: chatComposerRoot.themeObj.textMuted
                        font.pixelSize: 9
                        elide: Text.ElideRight
                        font.family: chatComposerRoot.bodyFont
                    }
                }

                CapsuleButton {
                    id: sendButton
                    label: "Send"
                    tag: ">"
                    primary: true
                    enabled: chatComposerRoot.controller && chatComposerRoot.controller.canSend
                    onClicked: {
                        chatComposerRoot.sendPenguinJump = true
                        chatComposerRoot.sendPenguinSpin = true
                        sendPenguinTimerLocal.restart()
                        chatComposerRoot.submitCurrentPrompt()
                    }
                    Layout.alignment: Qt.AlignBottom

                    Rectangle {
                        anchors.top: parent.top
                        anchors.horizontalCenter: parent.horizontalCenter
                        anchors.topMargin: -8
                        width: 20
                        height: 20
                        color: "transparent"
                        visible: sendButton.enabled

                        Image {
                            id: sendPenguinImage
                            anchors.centerIn: parent
                            width: 16
                            height: 16
                            source: {
                                var basePath = chatComposerRoot.mascotUrl.substring(0, chatComposerRoot.mascotUrl.lastIndexOf("/") + 1)
                                if (chatComposerRoot.gameMode === "gamer") return basePath + "waddle_8bit_gamer.svg"
                                if (chatComposerRoot.gameMode === "powerup") return basePath + "waddle_8bit_powerup.svg"
                                if (chatComposerRoot.gameMode === "pacman") return basePath + "waddle_8bit_pacman.svg"
                                if (chatComposerRoot.gameMode === "gameover") return basePath + "waddle_8bit_gameover.svg"
                                return basePath + "waddle_8bit.svg"
                            }
                            fillMode: Image.PreserveAspectFit
                            smooth: false

                            NumberAnimation on y {
                                from: -2
                                to: 2
                                duration: 400
                                loops: Animation.Infinite
                                easing.type: Easing.InOutSine
                                running: sendButton.enabled && !chatComposerRoot.sendPenguinJump
                            }

                            NumberAnimation on y {
                                from: 0
                                to: chatComposerRoot.animationConfig.sendPenguinJumpHeight || -12
                                duration: 200
                                easing.type: Easing.OutQuad
                                running: chatComposerRoot.sendPenguinJump
                            }

                            NumberAnimation on rotation {
                                from: 0
                                to: 360
                                duration: 500
                                easing.type: Easing.OutQuad
                                running: chatComposerRoot.sendPenguinSpin
                            }
                        }
                    }
                }
            }
        }
    }

    background: Rectangle {
        gradient: Gradient {
            GradientStop { position: 0.0; color: theme.bgTop }
            GradientStop { position: 1.0; color: theme.bgBottom }
        }

        Rectangle {
            width: Math.max(parent.width * 0.38, 320)
            height: width
            radius: width / 2
            x: -width * 0.33 + Math.sin(starDrift / 160) * 14
            y: parent.height - height * 0.58 + Math.cos(starDrift / 220) * 10
            color: Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.045 + (0.015 * (0.5 + Math.sin(ambientPulse * 6.28318530718) * 0.5)))
            scale: 1.0 + Math.sin(ambientPulse * 6.28318530718) * 0.03
        }

        Rectangle {
            width: Math.max(parent.width * 0.34, 280)
            height: width
            radius: width / 2
            x: parent.width - width * 0.62 + Math.cos(cloudDrift / 180) * 14
            y: -height * 0.40 + Math.sin(cloudDrift / 260) * 12
            color: Qt.rgba(theme.accentSoft.r, theme.accentSoft.g, theme.accentSoft.b, 0.025 + (0.015 * (0.5 + Math.cos(ambientPulse * 6.28318530718) * 0.5)))
            scale: 1.0 + Math.cos(ambientPulse * 6.28318530718) * 0.025
        }

        Rectangle {
            anchors.fill: parent
            color: "transparent"
            opacity: 0.16 + (0.05 * Math.sin(ambientPulse * 6.28318530718))
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(theme.accentSoft.r, theme.accentSoft.g, theme.accentSoft.b, 0.16) }
                GradientStop { position: 0.52; color: Qt.rgba(1, 1, 1, 0.00) }
                GradientStop { position: 1.0; color: Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, 0.14) }
            }
        }

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(0, 0, 0, 0.00) }
                GradientStop { position: 1.0; color: Qt.rgba(0, 0, 0, 0.24) }
            }
        }
    }

    Dialog {
        id: preferencesDialog
        modal: true
        focus: true
        x: Math.round((window.width - width) / 2)
        y: Math.round((window.height - height) / 2)
        width: Math.min(window.width - 80, 760)
        padding: 0
        closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
        background: Rectangle {
            color: theme.panel
            border.width: 1
            border.color: theme.borderStrong
            radius: cornerRadius + 2
        }

        onOpened: {
            if (window.controller) {
                vaultPathInput.text = window.controller.obsidianVaultPath
                codexCommandInput.text = window.controller.codexCommand
                qwenCommandInput.text = window.controller.qwenCommand
                displayNameInput.text = window.controller.displayName
            }
        }

        contentItem: ColumnLayout {
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 64
                color: theme.panelSoft
                border.width: 0

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 12

                    IconBadge {
                        label: "⚙"
                        fillColor: theme.accent
                    }

                    ColumnLayout {
                        spacing: 2

                        Text {
                            text: "Preferences"
                            color: theme.textPrimary
                            font.pixelSize: 18
                            font.weight: Font.DemiBold
                            font.family: window.displayFont
                        }

                        Text {
                            text: "Configure vault, commands, and display name."
                            color: theme.textSecondary
                            font.pixelSize: 12
                            font.family: window.bodyFont
                        }
                    }

                    Item { Layout.fillWidth: true }

                    CapsuleButton {
                        label: "Close"
                        tag: "X"
                        onClicked: preferencesDialog.close()
                    }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 14
                anchors.margins: 0

                Item { Layout.fillWidth: true; implicitHeight: 8 }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18

                    Text {
                        text: "Vault / workspace"
                        color: "#e9effd"
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        font.family: window.bodyFont
                    }

                    TextField {
                        id: vaultPathInput
                        Layout.fillWidth: true
                        placeholderText: "/home/you/Documents/vault"
                        color: theme.textPrimary
                        font.pixelSize: 14
                        font.family: window.bodyFont
                        selectedTextColor: "#ffffff"
                        selectionColor: theme.accent
                        background: Rectangle {
                            color: theme.panelInset
                            border.width: 1
                            border.color: theme.border
                            radius: cornerRadius * 0.65
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18

                    Text {
                        text: "Codex command"
                        color: "#e9effd"
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        font.family: window.bodyFont
                    }

                    TextField {
                        id: codexCommandInput
                        Layout.fillWidth: true
                        placeholderText: "codex"
                        color: theme.textPrimary
                        font.pixelSize: 14
                        font.family: window.bodyFont
                        selectedTextColor: "#ffffff"
                        selectionColor: theme.accent
                        background: Rectangle {
                            color: theme.panelInset
                            border.width: 1
                            border.color: theme.border
                            radius: cornerRadius * 0.65
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18

                    Text {
                        text: "Qwen command"
                        color: "#e9effd"
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        font.family: window.bodyFont
                    }

                    TextField {
                        id: qwenCommandInput
                        Layout.fillWidth: true
                        placeholderText: "qwen"
                        color: theme.textPrimary
                        font.pixelSize: 14
                        font.family: window.bodyFont
                        selectedTextColor: "#ffffff"
                        selectionColor: theme.accent
                        background: Rectangle {
                            color: theme.panelInset
                            border.width: 1
                            border.color: theme.border
                            radius: cornerRadius * 0.65
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18

                    Text {
                        text: "Display name"
                        color: "#e9effd"
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        font.family: window.bodyFont
                    }

                    TextField {
                        id: displayNameInput
                        Layout.fillWidth: true
                        placeholderText: "Your name"
                        color: theme.textPrimary
                        font.pixelSize: 14
                        font.family: window.bodyFont
                        selectedTextColor: "#ffffff"
                        selectionColor: theme.accent
                        background: Rectangle {
                            color: theme.panelInset
                            border.width: 1
                            border.color: theme.border
                            radius: cornerRadius * 0.65
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18
                    implicitHeight: settingsHelp.implicitHeight + 24
                    color: theme.panelSoft
                    border.width: 1
                    border.color: theme.border
                    radius: cornerRadius * 0.8

                    Text {
                        id: settingsHelp
                        anchors.fill: parent
                        anchors.margins: 12
                        wrapMode: Text.WordWrap
                        text: "Preferences are saved in the .env file. New sessions use the updated configuration. If a session is active, reconnect to apply new commands."
                        color: theme.textSecondary
                        font.pixelSize: 12
                        font.family: window.bodyFont
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 18
                    Layout.rightMargin: 18
                    Layout.bottomMargin: 18
                    spacing: 10

                    Item { Layout.fillWidth: true }

                    CapsuleButton {
                        label: "Cancel"
                        tag: "-"
                        onClicked: preferencesDialog.close()
                    }

                    CapsuleButton {
                        label: "Save"
                        tag: "OK"
                        primary: true
                        enabled: !!window.controller
                        onClicked: {
                            if (!window.controller) {
                                return
                            }
                            window.controller.saveSettings(
                                vaultPathInput.text,
                                codexCommandInput.text,
                                qwenCommandInput.text,
                                displayNameInput.text
                            )
                            preferencesDialog.close()
                        }
                    }
                }
            }
        }
    }

    ColumnLayout {
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.margins: 14
        width: Math.min(parent.width - 28, 980)
        spacing: 10

        ChatHeader {
            controller: window.controller
            themeObj: theme
            cornerRadius: window.cornerRadius
            displayFont: window.displayFont
            bodyFont: window.bodyFont
            introProgress: window.introProgress
            windowWidth: window.width
            maximized: window.visibility === Window.Maximized
            onStartMove: function(mouse) {
                window.startSystemMove(mouse)
            }
            onOpenPreferences: preferencesDialog.open()
            onCycleMascot: {
                if (window.controller) {
                    window.controller.cycleMascot()
                }
            }
            onMinimizeRequested: window.showMinimized()
            onToggleMaximizeRequested: {
                if (window.visibility === Window.Maximized) {
                    window.showNormal()
                } else {
                    window.showMaximized()
                }
            }
            onCloseRequested: window.close()
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: cornerRadius + 4
            color: theme.panel
            border.width: 1
            border.color: theme.border
            opacity: 0.42 + (0.58 * Math.max(0, Math.min(1, (window.introProgress - 0.08) / 0.92)))
            scale: 0.985 + (0.015 * Math.max(0, Math.min(1, (window.introProgress - 0.08) / 0.92)))

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 14
                spacing: 10

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true

                    Flickable {
                        id: emptyStateFlick
                        anchors.fill: parent
                        visible: chatList.count <= 1
                        clip: true
                        boundsBehavior: Flickable.StopAtBounds
                        contentWidth: width
                        contentHeight: Math.max(height, emptyStateContent.implicitHeight + 48)
                        interactive: contentHeight > height
                        onVisibleChanged: {
                            if (visible) {
                                contentY = 0
                            }
                        }

                        Column {
                            id: emptyStateContent
                            width: Math.min(parent.width - 24, 700)
                            x: Math.max(0, (parent.width - width) / 2)
                            y: Math.max(24, (parent.height - implicitHeight) / 2)
                            spacing: 16

                            Rectangle {
                                visible: window.controller && window.missingCliNameSafe.length > 0
                                width: parent.width
                                implicitHeight: diagnosticColumn.implicitHeight + 28
                                color: "#28131d"
                                border.width: 1
                                border.color: "#ef4444"
                                radius: cornerRadius

                                ColumnLayout {
                                    id: diagnosticColumn
                                    anchors.fill: parent
                                    anchors.margins: 14
                                    spacing: 10

                                    RowLayout {
                                        spacing: 10

                                        IconBadge {
                                            label: "!"
                                            fillColor: "#5a1d2e"
                                            textColor: "#fff1f2"
                                        }

                                        ColumnLayout {
                                            spacing: 2

                                            Text {
                                                text: "CLI not found"
                                                color: "#fff1f2"
                                                font.pixelSize: 15
                                                font.weight: Font.DemiBold
                                                font.family: window.displayFont
                                            }

                                            Text {
                                                text: "Command '" + window.missingCliNameSafe + "' is not available in PATH."
                                                color: "#fecdd3"
                                                font.pixelSize: 12
                                                font.family: window.bodyFont
                                            }
                                        }
                                    }

                                    Rectangle {
                                        Layout.fillWidth: true
                                        implicitHeight: installHint.implicitHeight + 20
                                        color: "#160e1a"
                                        border.width: 1
                                        border.color: "#6b2136"
                                        radius: cornerRadius * 0.7

                                        Text {
                                            id: installHint
                                            anchors.fill: parent
                                            anchors.margins: 10
                                            wrapMode: Text.WordWrap
                                            text: {
                                                var cli = window.missingCliNameSafe
                                                var cmd = cli === "codex" ? "npm install -g @openai/codex" : "npm install -g qwen-code"
                                                return "Install the CLI and then click Reconnect.\n\n" +
                                                       "Option 1: Install with npm\n" +
                                                       "• " + cli + ": " + cmd + "\n\n" +
                                                       "Option 2: Use a custom path\n" +
                                                       "• Click Preferences and set the full command\n\n" +
                                                       "Option 3: Verify installation\n" +
                                                       "• Execute '" + cli + " --version' in terminal"
                                            }
                                            color: "#fda4af"
                                            font.pixelSize: 12
                                            font.family: window.bodyFont
                                        }
                                    }

                                    RowLayout {
                                        Layout.fillWidth: true
                                        spacing: 8

                                        CapsuleButton {
                                            label: "Preferences"
                                            tag: "⚙"
                                            enabled: true
                                            onClicked: preferencesDialog.open()
                                        }

                                        CapsuleButton {
                                            label: "Reconnect"
                                            tag: "⟩"
                                            primary: true
                                            enabled: !!window.controller
                                            onClicked: window.controller.connectBackend()
                                        }
                                    }
                                }
                            }

                            Item {
                                width: 220
                                height: 200
                                anchors.horizontalCenter: parent.horizontalCenter

                                Rectangle {
                                    id: speechBubbleBody
                                    anchors.top: parent.top
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.topMargin: 8
                                    implicitWidth: Math.min(240, speechText.implicitWidth + 20)
                                    implicitHeight: Math.max(32, speechText.implicitHeight + 12)
                                    radius: cornerRadius
                                    color: "#ffffff"
                                    border.width: 1
                                    border.color: "#475569"

                                    Text {
                                        id: speechText
                                        anchors.fill: parent
                                        anchors.margins: 8
                                        text: window.controller ? window.controller.greeting : "Hello"
                                        color: "#1e293b"
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        font.family: window.bodyFont
                                        wrapMode: Text.Wrap
                                        horizontalAlignment: Text.AlignHCenter
                                        maximumLineCount: 2
                                        elide: Text.ElideRight
                                    }
                                }

                                Canvas {
                                    anchors.top: speechBubbleBody.bottom
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.horizontalCenterOffset: 0
                                    width: 20
                                    height: 12

                                    onPaint: {
                                        var ctx = getContext("2d")
                                        ctx.reset()
                                        ctx.fillStyle = "#ffffff"
                                        ctx.strokeStyle = "#475569"
                                        ctx.lineWidth = 2
                                        ctx.beginPath()
                                        ctx.moveTo(0, 0)
                                        ctx.lineTo(width / 2, height)
                                        ctx.lineTo(width, 0)
                                        ctx.closePath()
                                        ctx.fill()
                                        ctx.stroke()
                                    }
                                }

                                Item {
                                    id: mascotContainer
                                    anchors.bottom: parent.bottom
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.bottomMargin: 4 + Math.sin(floatPhase * 6.28318530718) * 4
                                    width: 160
                                    height: 160
                                    property real floatPhase: 0
                                    // Walk animation support - bind directly to window property
                                    x: (window.mascotWalkX - 0.5) * (mascotContainer.parent ? mascotContainer.parent.width : 160)

                                    Behavior on x {
                                        enabled: false  // We control animation manually
                                    }

                                    NumberAnimation on floatPhase {
                                        from: 0
                                        to: 1
                                        duration: 3600
                                        loops: Animation.Infinite
                                        running: !window.mascotWalkingOut && !window.mascotWalkingIn
                                    }

                                    // Walk animation image
                                    Image {
                                        id: mascotWalkImage
                                        anchors.centerIn: parent
                                        width: parent.width
                                        height: parent.height
                                        source: getMascotWalkUrl()
                                        fillMode: Image.PreserveAspectFit
                                        smooth: false
                                        antialiasing: false
                                        visible: window.mascotWalkingOut || window.mascotWalkingIn
                                        z: 10

                                        // Flip sprite when walking in from left
                                        transform: [
                                            Scale {
                                                xScale: window.mascotWalkingIn ? -1 : 1
                                                yScale: 1
                                                origin.x: mascotWalkImage.width / 2
                                                origin.y: mascotWalkImage.height / 2
                                            }
                                        ]
                                    }

                                    // Normal mascot image
                                    Image {
                                        id: mascotImage
                                        anchors.centerIn: parent
                                        width: parent.width
                                        height: parent.height
                                        source: mascotBlinking ? getMascotBlinkUrl() : getMascotUrlForState(mascotState)
                                        fillMode: Image.PreserveAspectFit
                                        smooth: false
                                        antialiasing: false
                                        clip: false
                                        visible: !window.mascotWalkingOut && !window.mascotWalkingIn

                                        // Eye tracking overlay - draws pupils that follow cursor
                                        Item {
                                            id: pupilOverlay
                                            anchors.fill: parent
                                            visible: !mascotBlinking && !window.mascotWalkingOut && !window.mascotWalkingIn
                                            
                                            // Left pupil
                                            Rectangle {
                                                x: parent.width * 0.28 + window.eyeOffsetX
                                                y: parent.height * 0.35 + window.eyeOffsetY
                                                width: 4
                                                height: 4
                                                color: "#1e293b"
                                                radius: 2
                                            }
                                            
                                            // Right pupil
                                            Rectangle {
                                                x: parent.width * 0.62 + window.eyeOffsetX
                                                y: parent.height * 0.35 + window.eyeOffsetY
                                                width: 4
                                                height: 4
                                                color: "#1e293b"
                                                radius: 2
                                            }
                                        }

                                        // Opacity animation for state transitions
                                        PropertyAnimation {
                                            id: mascotFadeOut
                                            target: mascotImage
                                            property: "opacity"
                                            to: 0.3
                                            duration: 120
                                            easing.type: Easing.InOutQuad
                                            onFinished: mascotFadeIn.start()
                                        }

                                        PropertyAnimation {
                                            id: mascotFadeIn
                                            target: mascotImage
                                            property: "opacity"
                                            to: 1.0
                                            duration: 120
                                            easing.type: Easing.OutQuad
                                        }

                                        // Scale animation based on state
                                        PropertyAnimation {
                                            id: mascotStateScale
                                            target: mascotImage
                                            property: "scale"
                                            duration: 180
                                            easing.type: Easing.OutBack
                                        }

                                        states: [
                                            State {
                                                name: "idle"
                                                when: mascotState === "idle"
                                                PropertyChanges { target: mascotImage; scale: 1.0 }
                                            },
                                            State {
                                                name: "thinking"
                                                when: mascotState === "thinking"
                                                PropertyChanges { target: mascotImage; scale: 1.08 }
                                            },
                                            State {
                                                name: "streaming"
                                                when: mascotState === "streaming"
                                                PropertyChanges { target: mascotImage; scale: 1.0 }
                                            },
                                            State {
                                                name: "success"
                                                when: mascotState === "success"
                                                PropertyChanges { target: mascotImage; scale: 1.15 }
                                            },
                                            State {
                                                name: "error"
                                                when: mascotState === "error"
                                                PropertyChanges { target: mascotImage; scale: 0.95 }
                                            }
                                        ]

                                        // Trigger fade animation on state change
                                        onSourceChanged: {
                                            if (mascotState !== "idle") {
                                                mascotFadeOut.start()
                                            }
                                        }

                                        SequentialAnimation {
                                            id: footTapAnimation
                                            running: mascotState === "idle" || mascotState === "success"
                                            loops: 1

                                            NumberAnimation {
                                                target: mascotImage
                                                property: "scale"
                                                to: 1.05
                                                duration: 150
                                                easing.type: Easing.OutQuad
                                            }
                                            NumberAnimation {
                                                target: mascotImage
                                                property: "scale"
                                                to: 1.0
                                                duration: 150
                                                easing.type: Easing.InQuad
                                            }
                                            PauseAnimation { duration: 100 }
                                            NumberAnimation {
                                                target: mascotImage
                                                property: "scale"
                                                to: 1.05
                                                duration: 150
                                                easing.type: Easing.OutQuad
                                            }
                                            NumberAnimation {
                                                target: mascotImage
                                                property: "scale"
                                                to: 1.0
                                                duration: 150
                                                easing.type: Easing.InQuad
                                            }
                                        }
                                    }

                                    Component.onCompleted: {
                                        footTapAnimation.start()
                                        // Start with mascot walking in from left
                                        Qt.callLater(function() {
                                            startWalkIn()
                                        })
                                    }
                                }

                                Text {
                                    anchors.centerIn: parent
                                    text: "🐧"
                                    font.pixelSize: 80
                                    visible: mascotImage.status === Image.Error

                                    SequentialAnimation on scale {
                                        loops: Animation.Infinite
                                        running: visible
                                        NumberAnimation { to: 1.1; duration: 800; easing.type: Easing.InOutSine }
                                        NumberAnimation { to: 1.0; duration: 800; easing.type: Easing.InOutSine }
                                    }
                                }
                            }

                            Column {
                                width: parent.width
                                spacing: 12

                                Text {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    text: window.controller ? window.controller.greetingSubtitle : "How can I help you today?"
                                    color: theme.textSecondary
                                    font.pixelSize: 14
                                    font.family: window.bodyFont
                                }

                                Rectangle {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    implicitWidth: backendLabel.implicitWidth + 26
                                    implicitHeight: 36
                                    radius: 18
                                    color: theme.panelSoft
                                    border.width: 1
                                    border.color: theme.border

                                    Text {
                                        id: backendLabel
                                        anchors.centerIn: parent
                                        text: "Using " + (window.controller ? window.controller.currentBackendLabel : "CLI")
                                        color: theme.textPrimary
                                        font.pixelSize: 13
                                        font.weight: Font.Medium
                                        font.family: window.bodyFont
                                    }
                                }
                            }

                            GridLayout {
                                width: parent.width
                                columns: 2
                                rowSpacing: 10
                                columnSpacing: 10

                                Repeater {
                                    model: window.starterCards

                                    StarterCard {
                                        Layout.fillWidth: true
                                        Layout.preferredHeight: 116
                                        revealIndex: index
                                        tag: modelData.tag
                                        title: modelData.title
                                        subtitle: modelData.subtitle
                                        onClicked: {
                                            chatComposer.promptText = modelData.prompt
                                            chatComposer.focusPrompt()
                                        }
                                    }
                                }
                            }
                        }
                    }

                    ChatMessageList {
                        id: chatList
                        anchors.fill: parent
                        controller: window.controller
                        themeObj: theme
                        cornerRadius: window.cornerRadius
                        bodyFont: window.bodyFont
                        onCopyRequested: function(text) {
                            try {
                                Qt.application.clipboard().text = text
                            } catch (err) {
                                console.log("clipboard copy failed: " + err)
                            }
                        }
                    }
                }

                ChatComposer {
                    id: chatComposer
                    controller: window.controller
                    themeObj: theme
                    cornerRadius: window.cornerRadius
                    bodyFont: window.bodyFont
                    mascotState: window.mascotState
                    mascotUrl: mascotUrl
                    gameMode: window.gameMode
                    animationConfig: window.animationConfig
                    mascotStateResolver: window.getMascotUrlForState
                    onSendPrompt: function(text) {
                        window.submitPrompt(text)
                    }
                    onConnectRequested: {
                        if (window.controller) {
                            window.controller.connectBackend()
                        }
                    }
                    onStopRequested: {
                        if (window.controller) {
                            window.controller.stopSession()
                        }
                    }
                    onQuickCommand: function(command) {
                        if (window.controller) {
                            window.controller.sendQuickCommand(command)
                        }
                    }
                    onBackendSelected: function(key) {
                        if (window.controller) {
                            window.controller.selectedBackend = key
                        }
                    }
                    onCycleMascot: {
                        if (window.controller) {
                            window.controller.cycleMascot()
                        }
                    }
                }
            }
        }
    }

    // Invisible mouse area for eye tracking
    MouseArea {
        id: eyeTrackingArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.ArrowCursor
        acceptedButtons: Qt.NoButton  // Don't intercept clicks

        onPositionChanged: function(mouse) {
            updateEyeTracking(mouse.x, mouse.y)
        }
    }
}
