import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window

    width: 1280
    height: 860
    minimumWidth: 1080
    minimumHeight: 760
    visible: true
    title: "Waddle"
    color: "#0b1020"
    objectName: "waddle"

    property string displayFont: "Sans Serif"
    property string bodyFont: "Sans Serif"
    property string monoFont: "Monospace"
    property var controller: (typeof chatController !== "undefined") ? chatController : null
    property var starterCards: [
        { tag: "<>", title: "Write code", subtitle: "Implementacoes limpas e diretas.", prompt: "Escreva uma implementacao limpa para este problema." },
        { tag: "Aa", title: "Refine text", subtitle: "Melhorar estrutura e clareza.", prompt: "Me ajude a reescrever este texto com mais clareza." },
        { tag: "::", title: "Summarize", subtitle: "Pontos curtos e objetivos.", prompt: "Resuma este conteudo em pontos curtos e objetivos." },
        { tag: "??", title: "Plan steps", subtitle: "Transformar ideias em acao.", prompt: "Me ajude a organizar essa ideia em proximos passos claros." }
    ]

    function submitPrompt() {
        if (!window.controller) {
            return
        }
        let text = promptInput.text.trim()
        if (text.length === 0) {
            return
        }
        window.controller.sendPrompt(text)
        promptInput.text = ""
        promptInput.forceActiveFocus()
    }

    function pinChatToBottom() {
        Qt.callLater(function() {
            if (chatList.count > 0) {
                chatList.positionViewAtEnd()
            }
        })
    }

    component IconBadge: Rectangle {
        id: iconBadge

        property string label: ""
        property color fillColor: "#2a1d4d"
        property color textColor: "#eef4ff"

        implicitWidth: 32
        implicitHeight: 32
        radius: 0
        color: fillColor
        border.width: 2
        border.color: "#4b3474"

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
        signal clicked()

        implicitWidth: buttonRow.implicitWidth + 20
        implicitHeight: 40
        radius: 0
        color: !enabled
            ? "#171d31"
            : primary
                ? "#7c3aed"
                : active
                    ? "#4c1d95"
                    : buttonArea.containsMouse
                        ? "#3d2a67"
                        : "#2a1d47"
        border.width: 2
        border.color: primary
            ? "#a78bfa"
            : active
                ? "#b88cff"
                : "#4b3474"
        opacity: enabled ? 1.0 : 0.5
        scale: buttonArea.pressed ? 0.98 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 80 }
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
                implicitWidth: 20
                implicitHeight: 20
                radius: 0
                color: capsuleButton.primary ? "#a78bfa" : "#4b3474"
                border.width: 0

                Text {
                    anchors.centerIn: parent
                    text: capsuleButton.tag
                    color: capsuleButton.primary ? "#1e1b4b" : "#eef4ff"
                    font.pixelSize: 10
                    font.weight: Font.Bold
                    font.family: window.displayFont
                }
            }

            Text {
                text: capsuleButton.label
                color: capsuleButton.primary ? "#ffffff" : "#e2e8f0"
                font.pixelSize: 13
                font.weight: Font.DemiBold
                font.family: window.bodyFont
            }
        }
    }

    component StatusBadge: Rectangle {
        id: statusBadge

        property string tone: "idle"
        property string label: ""

        implicitWidth: statusRow.implicitWidth + 20
        implicitHeight: 34
        radius: 0
        color: tone === "ready"
            ? "#24183b"
            : tone === "starting"
                ? "#443115"
                : tone === "error"
                    ? "#462127"
                    : "#151d31"
        border.width: 2
        border.color: tone === "ready"
            ? "#a78bfa"
            : tone === "starting"
                ? "#f2a72f"
                : tone === "error"
                    ? "#ee7d86"
                    : "#2b3652"

        RowLayout {
            id: statusRow
            anchors.centerIn: parent
            spacing: 8

            Rectangle {
                width: 8
                height: 8
                radius: 0
                color: tone === "ready"
                    ? "#a78bfa"
                    : tone === "starting"
                        ? "#f2a72f"
                        : tone === "error"
                            ? "#ee7d86"
                            : "#8b7ad1"
            }

            Text {
                text: statusBadge.label
                color: "#eef4ff"
                font.pixelSize: 12
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
        signal clicked()

        radius: 0
        color: cardArea.containsMouse ? "#18213a" : "#12192d"
        border.width: 2
        border.color: cardArea.containsMouse ? "#624493" : "#3b295e"
        scale: cardArea.pressed ? 0.98 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 80 }
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
            anchors.margins: 18
            spacing: 14

            IconBadge {
                label: starterCard.tag
                fillColor: "#2a1d4d"
                textColor: "#eef4ff"
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4

                Text {
                    text: starterCard.title
                    color: "#f8fbff"
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }

                Text {
                    Layout.fillWidth: true
                    text: starterCard.subtitle
                    color: "#91a4cb"
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    font.family: window.bodyFont
                }
            }
        }
    }

    background: Rectangle {
        color: "#1a1038"

        // Big pixel grid pattern
        Repeater {
            model: 40
            delegate: Rectangle {
                width: 60
                height: 60
                x: (index % 20) * 60
                y: Math.floor(index / 20) * 60
                color: (index % 2 === 0) ? "#2a1450" : "#1a1038"
                opacity: 0.5
            }
        }

        // Big pixel stars
        Rectangle { width: 12; height: 12; x: 120; y: 100; color: "#a78bfa" }
        Rectangle { width: 12; height: 12; x: 280; y: 180; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 450; y: 120; color: "#a78bfa" }
        Rectangle { width: 12; height: 12; x: 620; y: 220; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 800; y: 140; color: "#a78bfa" }
        Rectangle { width: 12; height: 12; x: 980; y: 200; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 1150; y: 110; color: "#a78bfa" }

        Rectangle { width: 12; height: 12; x: 200; y: 350; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 500; y: 400; color: "#a78bfa" }
        Rectangle { width: 12; height: 12; x: 750; y: 370; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 1050; y: 420; color: "#a78bfa" }

        Rectangle { width: 12; height: 12; x: 350; y: 550; color: "#a78bfa" }
        Rectangle { width: 12; height: 12; x: 650; y: 600; color: "#c4b5fd" }
        Rectangle { width: 12; height: 12; x: 950; y: 530; color: "#a78bfa" }

        // Big pixel clouds - blocky style
        Rectangle { width: 60; height: 24; x: 180; y: 650; color: "#4c1d95"; opacity: 0.5 }
        Rectangle { width: 36; height: 24; x: 156; y: 626; color: "#4c1d95"; opacity: 0.5 }
        Rectangle { width: 36; height: 24; x: 204; y: 626; color: "#4c1d95"; opacity: 0.5 }

        Rectangle { width: 72; height: 24; x: 520; y: 700; color: "#4c1d95"; opacity: 0.4 }
        Rectangle { width: 42; height: 24; x: 496; y: 676; color: "#4c1d95"; opacity: 0.4 }
        Rectangle { width: 42; height: 24; x: 550; y: 676; color: "#4c1d95"; opacity: 0.4 }

        Rectangle { width: 48; height: 24; x: 880; y: 620; color: "#4c1d95"; opacity: 0.5 }
        Rectangle { width: 30; height: 24; x: 862; y: 596; color: "#4c1d95"; opacity: 0.5 }
        Rectangle { width: 30; height: 24; x: 898; y: 596; color: "#4c1d95"; opacity: 0.5 }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 22
        spacing: 18

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 72
            radius: 0
            color: "#22121f30"
            border.width: 2
            border.color: "#422f67"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 18
                spacing: 14

                IconBadge {
                    label: "OS"
                    fillColor: "#2a1d4d"
                }

                Text {
                    text: "Waddle"
                    color: "#f7fbff"
                    font.pixelSize: 17
                    font.weight: Font.DemiBold
                    font.family: window.displayFont
                }

                Item {
                    Layout.fillWidth: true
                }

                Rectangle {
                    radius: 18
                    color: "#171427"
                    border.width: 1
                    border.color: "#4b3474"
                    implicitHeight: 42
                    implicitWidth: navRow.implicitWidth + 14

                    RowLayout {
                        id: navRow
                        anchors.centerIn: parent
                        spacing: 4

                        CapsuleButton { label: "Chat"; active: true; enabled: false }
                        CapsuleButton { label: "Work"; enabled: false }
                        CapsuleButton { label: "Sandbox"; enabled: false }
                    }
                }

                Item {
                    Layout.fillWidth: true
                }

                StatusBadge {
                    label: window.controller ? window.controller.statusTitle : "Carregando"
                    tone: window.controller ? window.controller.bridgeStatus : "idle"
                }

                CapsuleButton {
                    label: window.controller ? window.controller.currentBackendLabel : "CLI"
                    tag: window.controller && window.controller.currentBackendLabel === "Codex" ? "C" : "Q"
                    active: true
                    enabled: false
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: 0
            color: "#2a0c1324"
            border.width: 2
            border.color: "#422f67"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 26
                spacing: 20

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true

                    Flickable {
                        anchors.fill: parent
                        visible: chatList.count === 0
                        clip: true
                        boundsBehavior: Flickable.StopAtBounds
                        contentWidth: width
                        contentHeight: Math.max(height, emptyStateContent.implicitHeight + 48)
                        interactive: contentHeight > height

                        Column {
                            id: emptyStateContent
                            width: Math.min(parent.width - 40, 760)
                            x: Math.max(0, (parent.width - width) / 2)
                            y: Math.max(24, (parent.height - implicitHeight) / 2)
                            spacing: 24

                            Item {
                                width: 220
                                height: 200
                                anchors.horizontalCenter: parent.horizontalCenter

                                // Speech bubble with rounded corners
                                Rectangle {
                                    id: speechBubbleBody
                                    anchors.top: parent.top
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.topMargin: 8
                                    width: 140
                                    height: 32
                                    radius: 0
                                    color: "#ffffff"
                                    border.width: 3
                                    border.color: "#475569"

                                    Text {
                                        id: speechText
                                        anchors.centerIn: parent
                                        text: window.controller ? window.controller.greeting : "Ola"
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

                                // Speech bubble tail (triangle pointing up)
                                Canvas {
                                    anchors.top: speechBubbleBody.bottom
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.horizontalCenterOffset: -25
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
                                    width: 160
                                    height: 160

                                    Image {
                                        id: mascotImage
                                        anchors.centerIn: parent
                                        width: parent.width
                                        height: parent.height
                                        source: mascotUrl
                                        fillMode: Image.PreserveAspectFit
                                        smooth: false
                                        antialiasing: false

                                        // Foot tapping animation on first load
                                        SequentialAnimation {
                                            id: footTapAnimation
                                            running: false
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
                                    }
                                }

                                // Fallback penguin emoji if SVG doesn't load
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
                                    text: window.controller ? window.controller.greetingSubtitle : "Como posso ajudar voce hoje?"
                                    color: "#94a3b8"
                                    font.pixelSize: 14
                                    font.family: window.bodyFont
                                }

                                Rectangle {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    implicitWidth: backendLabel.implicitWidth + 26
                                    implicitHeight: 36
                                    radius: 18
                                    color: "#141b30"
                                    border.width: 1
                                    border.color: "#4b3474"

                                    Text {
                                        id: backendLabel
                                        anchors.centerIn: parent
                                        text: "Usando " + (window.controller ? window.controller.currentBackendLabel : "CLI")
                                        color: "#e9effd"
                                        font.pixelSize: 13
                                        font.weight: Font.Medium
                                        font.family: window.bodyFont
                                    }
                                }
                            }

                            GridLayout {
                                width: parent.width
                                columns: 2
                                rowSpacing: 14
                                columnSpacing: 14

                                Repeater {
                                    model: window.starterCards

                                    StarterCard {
                                        Layout.fillWidth: true
                                        Layout.preferredHeight: 118
                                        tag: modelData.tag
                                        title: modelData.title
                                        subtitle: modelData.subtitle
                                        onClicked: {
                                            promptInput.text = modelData.prompt
                                            promptInput.forceActiveFocus()
                                        }
                                    }
                                }
                            }
                        }
                    }

                    ListView {
                        id: chatList
                        anchors.fill: parent
                        model: window.controller ? window.controller.messagesModel : null
                        spacing: 14
                        clip: true
                        visible: count > 0
                        boundsBehavior: Flickable.StopAtBounds

                        delegate: Item {
                            required property string role
                            required property string content
                            required property string meta

                            width: chatList.width
                            implicitHeight: bubbleBox.implicitHeight + 12

                            Rectangle {
                                id: bubbleBox
                                width: Math.min(chatList.width * 0.8, 820)
                                implicitHeight: bubbleColumn.implicitHeight + 28
                                anchors.right: role === "user" ? parent.right : undefined
                                anchors.left: role === "user" ? undefined : parent.left
                                radius: 0
                                color: role === "user"
                                    ? "#efe7ff"
                                    : role === "system"
                                        ? "#18213b"
                                        : "#131a2f"
                                border.width: 2
                                border.color: role === "user"
                                    ? "#d8c2ff"
                                    : role === "system"
                                        ? "#5a3f89"
                                        : "#3b295e"

                                RowLayout {
                                    id: bubbleColumn
                                    anchors.fill: parent
                                    anchors.margins: 16
                                    spacing: 12

                                    IconBadge {
                                        label: role === "user" ? "U" : (role === "system" ? "!" : "A")
                                        fillColor: role === "user" ? "#eadcff" : "#2a1d4d"
                                        textColor: role === "user" ? "#3b2462" : "#eef4ff"
                                        Layout.alignment: Qt.AlignTop
                                    }

                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 6

                                        Text {
                                            text: role === "user" ? "Voce" : (meta.length > 0 ? meta : "Agente")
                                            color: role === "user" ? "#8b5cf6" : "#b8a8dc"
                                            font.pixelSize: 12
                                            font.weight: Font.Medium
                                            font.family: window.bodyFont
                                        }

                                        Text {
                                            Layout.fillWidth: true
                                            text: content
                                            color: role === "user" ? "#0f172a" : "#f8fbff"
                                            font.pixelSize: 14
                                            wrapMode: Text.Wrap
                                            font.family: window.bodyFont
                                        }
                                    }
                                }
                            }
                        }

                        ScrollBar.vertical: ScrollBar {
                            policy: ScrollBar.AsNeeded
                        }

                        onCountChanged: window.pinChatToBottom()
                        onContentHeightChanged: window.pinChatToBottom()
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.minimumHeight: 194
                    Layout.preferredHeight: 194
                    radius: 0
                    color: "#3011192a"
                    border.width: 2
                    border.color: "#3b295e"

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 10

                            Rectangle {
                                radius: 0
                                color: "#12192d"
                                border.width: 2
                                border.color: "#3b295e"
                                implicitHeight: 44
                                implicitWidth: backendRow.implicitWidth + 10

                                RowLayout {
                                    id: backendRow
                                    anchors.centerIn: parent
                                    spacing: 6

                                    Repeater {
                                        model: [
                                            { key: "codex", label: "Codex", tag: "C" },
                                            { key: "qwen", label: "Qwen", tag: "Q" }
                                        ]

                                        CapsuleButton {
                                            label: modelData.label
                                            tag: modelData.tag
                                            active: window.controller && window.controller.selectedBackend === modelData.key
                                            enabled: !!window.controller
                                            onClicked: window.controller.selectedBackend = modelData.key
                                        }
                                    }
                                }
                            }

                            CapsuleButton {
                                label: window.controller && window.controller.bridgeStatus === "ready" ? "Reconectar" : "Conectar"
                                tag: ">"
                                enabled: !!window.controller
                                onClicked: window.controller.connectBackend()
                            }

                            CapsuleButton {
                                label: "Parar"
                                tag: "[]"
                                enabled: window.controller && window.controller.canStop
                                onClicked: window.controller.stopSession()
                            }

                            CapsuleButton {
                                label: "/model"
                                tag: "M"
                                enabled: window.controller && window.controller.canSend
                                onClicked: window.controller.sendQuickCommand("/model")
                            }

                            CapsuleButton {
                                label: "/reset"
                                tag: "R"
                                enabled: window.controller && window.controller.canSend
                                onClicked: window.controller.sendQuickCommand("/reset")
                            }

                            Item {
                                Layout.fillWidth: true
                            }

                            Text {
                                text: "Enter para enviar"
                                color: "#b39adf"
                                font.pixelSize: 12
                                font.family: window.bodyFont
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            Layout.minimumHeight: 118
                            radius: 0
                            color: "#0c1222"
                            border.width: 2
                            border.color: "#26324f"

                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 14
                                spacing: 12

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    spacing: 8

                                    TextArea {
                                        id: promptInput
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true
                                        wrapMode: TextEdit.Wrap
                                        placeholderText: window.controller ? window.controller.composerPlaceholder : "Comece a conversa..."
                                        placeholderTextColor: "#9b86c7"
                                        color: "#f8fbff"
                                        selectionColor: "#b88cff"
                                        font.pixelSize: 18
                                        font.family: window.bodyFont
                                        padding: 0
                                        enabled: window.controller && window.controller.canSend

                                        background: Rectangle {
                                            color: "transparent"
                                        }

                                        Keys.onPressed: function(event) {
                                            if ((event.key === Qt.Key_Return || event.key === Qt.Key_Enter)
                                                    && !(event.modifiers & Qt.ShiftModifier)) {
                                                event.accepted = true
                                                window.submitPrompt()
                                            }
                                        }

                                        Component.onCompleted: forceActiveFocus()
                                    }

                                    Text {
                                        Layout.fillWidth: true
                                        text: window.controller ? window.controller.statusDescription : "Carregando controlador..."
                                        color: "#b59fdb"
                                        font.pixelSize: 13
                                        elide: Text.ElideRight
                                        font.family: window.bodyFont
                                    }
                                }

                                CapsuleButton {
                                    label: "Enviar"
                                    tag: ">>"
                                    primary: true
                                    enabled: window.controller && window.controller.canSend
                                    onClicked: window.submitPrompt()
                                    Layout.alignment: Qt.AlignBottom
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
