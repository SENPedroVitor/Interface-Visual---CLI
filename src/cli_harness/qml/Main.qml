import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window

    width: 1440
    height: 920
    minimumWidth: 1180
    minimumHeight: 760
    visible: true
    title: "Osaurus Native"
    color: "#0b1020"

    property string displayFont: "SF Pro Display"
    property string bodyFont: "SF Pro Text"
    property var controller: (typeof chatController !== "undefined") ? chatController : null
    property var backends: ["codex", "qwen"]
    property var starterCards: [
        { icon: "</>", title: "Escrever codigo", subtitle: "Comecar implementacoes limpas e diretas.", prompt: "Escreva uma implementacao limpa para este problema." },
        { icon: "Aa", title: "Lapidar texto", subtitle: "Melhorar estrutura, clareza e tom.", prompt: "Me ajude a reescrever este texto com mais clareza e melhor estrutura." },
        { icon: "::", title: "Resumir conteudo", subtitle: "Compactar blocos grandes em pontos uteis.", prompt: "Resuma este conteudo em pontos curtos e objetivos." },
        { icon: "?", title: "Planejar proximo passo", subtitle: "Transformar ideias em acao organizada.", prompt: "Me ajude a organizar essa ideia em proximos passos claros." }
    ]

    function submitPrompt() {
        if (!window.controller) {
            return
        }
        if (promptInput.text.trim().length === 0) {
            return
        }

        window.controller.sendPrompt(promptInput.text)
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

    component CapsuleButton: Rectangle {
        id: capsuleButton

        property string label: ""
        property bool active: false
        property bool primary: false
        signal clicked()

        implicitWidth: capsuleLabel.implicitWidth + 28
        implicitHeight: 40
        radius: 15
        color: !enabled
            ? "#151d31"
            : primary
                ? "#eff3ff"
                : active
                    ? "#283a63"
                    : buttonArea.containsMouse
                        ? "#1f2943"
                        : "#171f35"
        border.width: 1
        border.color: primary
            ? "#ffffff"
            : active
                ? "#6e95ff"
                : "#2a3554"
        opacity: enabled ? 1.0 : 0.45
        scale: buttonArea.pressed ? 0.985 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 90 }
        }

        MouseArea {
            id: buttonArea
            anchors.fill: parent
            enabled: capsuleButton.enabled
            hoverEnabled: true
            cursorShape: capsuleButton.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: capsuleButton.clicked()
        }

        Text {
            id: capsuleLabel
            anchors.centerIn: parent
            text: capsuleButton.label
            color: primary ? "#0f172a" : "#eff4ff"
            font.pixelSize: 13
            font.weight: Font.DemiBold
            font.family: window.bodyFont
        }
    }

    component NavChip: Rectangle {
        id: navChip

        property string label: ""
        property bool active: false

        implicitWidth: navLabel.implicitWidth + 26
        implicitHeight: 38
        radius: 13
        color: active ? "#2a3558" : "transparent"
        border.width: active ? 1 : 0
        border.color: "#34456f"

        Text {
            id: navLabel
            anchors.centerIn: parent
            text: navChip.label
            color: active ? "#f7f9ff" : "#9aaed5"
            font.pixelSize: 13
            font.weight: active ? Font.DemiBold : Font.Medium
            font.family: window.bodyFont
        }
    }

    component SuggestionCard: Rectangle {
        id: suggestionCard

        property string icon: ""
        property string title: ""
        property string subtitle: ""
        property string prompt: ""
        signal clicked()

        radius: 22
        color: suggestionArea.containsMouse ? "#18213a" : "#131a2f"
        border.width: 1
        border.color: suggestionArea.containsMouse ? "#31456f" : "#202b47"
        scale: suggestionArea.pressed ? 0.99 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 90 }
        }

        MouseArea {
            id: suggestionArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: suggestionCard.clicked()
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 12

            Rectangle {
                Layout.preferredWidth: 42
                Layout.preferredHeight: 42
                radius: 14
                color: "#1e2947"
                border.width: 1
                border.color: "#30415f"

                Text {
                    anchors.centerIn: parent
                    text: suggestionCard.icon
                    color: "#eef2ff"
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4

                Text {
                    text: suggestionCard.title
                    color: "#f8faff"
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }

                Text {
                    Layout.fillWidth: true
                    text: suggestionCard.subtitle
                    color: "#95a8ce"
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    font.family: window.bodyFont
                }
            }
        }
    }

    component StatusBadge: Rectangle {
        id: statusBadge

        property string tone: "idle"
        property string label: ""

        implicitWidth: badgeLabel.implicitWidth + 24
        implicitHeight: 34
        radius: 999
        color: tone === "ready"
            ? "#173228"
            : tone === "starting"
                ? "#453116"
                : tone === "error"
                    ? "#452027"
                    : "#171f35"
        border.width: 1
        border.color: tone === "ready"
            ? "#37d0ae"
            : tone === "starting"
                ? "#f2a72f"
                : tone === "error"
                    ? "#ee7d86"
                    : "#2a3554"

        Text {
            id: badgeLabel
            anchors.centerIn: parent
            text: statusBadge.label
            color: "#eef3ff"
            font.pixelSize: 12
            font.weight: Font.DemiBold
            font.family: window.bodyFont
        }
    }

    background: Rectangle {
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#171438" }
            GradientStop { position: 0.42; color: "#10214a" }
            GradientStop { position: 1.0; color: "#08101f" }
        }

        Rectangle {
            width: 620
            height: 620
            radius: 310
            x: window.width * 0.5 - width / 2
            y: -350
            color: "#2d6cff48"
        }

        Rectangle {
            width: 420
            height: 420
            radius: 210
            x: window.width - 280
            y: window.height * 0.50
            color: "#1f4aff2d"
        }

        Rectangle {
            width: 300
            height: 300
            radius: 150
            x: -120
            y: window.height - 120
            color: "#1cc0ff22"
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 22
        spacing: 18

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 74
            radius: 26
            color: "#1b112330"
            border.width: 1
            border.color: "#243150"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 18
                spacing: 14

                Rectangle {
                    Layout.preferredWidth: 44
                    Layout.preferredHeight: 44
                    radius: 16
                    color: "#1a2440"
                    border.width: 1
                    border.color: "#314264"

                    Text {
                        anchors.centerIn: parent
                        text: "OS"
                        color: "#f8fbff"
                        font.pixelSize: 13
                        font.weight: Font.Bold
                        font.family: window.displayFont
                    }
                }

                Rectangle {
                    radius: 18
                    color: "#141a2c"
                    border.width: 1
                    border.color: "#242f4e"
                    implicitHeight: 44
                    implicitWidth: navRow.implicitWidth + 14

                    RowLayout {
                        id: navRow
                        anchors.centerIn: parent
                        spacing: 4

                        NavChip { label: "Chat"; active: true }
                        NavChip { label: "Work" }
                        NavChip { label: "Sandbox" }
                    }
                }

                Item { Layout.fillWidth: true }

                StatusBadge {
                    label: window.controller ? window.controller.statusTitle : "Carregando"
                    tone: window.controller ? window.controller.bridgeStatus : "idle"
                }

                CapsuleButton {
                    label: window.controller ? window.controller.currentBackendLabel : "CLI"
                    active: true
                    enabled: false
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: 34
            color: "#2e0b1325"
            border.width: 1
            border.color: "#243150"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 26
                spacing: 20

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true

                    Column {
                        anchors.centerIn: parent
                        width: 760
                        spacing: 24
                        visible: chatList.count === 0

                        Item {
                            width: 126
                            height: 126
                            anchors.horizontalCenter: parent.horizontalCenter

                            Rectangle {
                                anchors.centerIn: parent
                                width: 126
                                height: 126
                                radius: 63
                                color: "#32b6ff30"
                            }

                            Rectangle {
                                anchors.centerIn: parent
                                width: 88
                                height: 88
                                radius: 44
                                color: "#e7f6ffdd"
                            }

                            Rectangle {
                                anchors.centerIn: parent
                                width: 22
                                height: 22
                                radius: 11
                                color: "#8bd4ff"
                            }
                        }

                        Column {
                            width: parent.width
                            spacing: 8

                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                text: window.controller ? window.controller.greeting : "Ola"
                                color: "#f8faff"
                                font.pixelSize: 58
                                font.weight: Font.Bold
                                font.family: window.displayFont
                            }

                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                text: "Como posso ajudar voce hoje?"
                                color: "#c2cee7"
                                font.pixelSize: 20
                                font.family: window.bodyFont
                            }

                            Rectangle {
                                anchors.horizontalCenter: parent.horizontalCenter
                                implicitWidth: backendBadgeLabel.implicitWidth + 26
                                implicitHeight: 36
                                radius: 18
                                color: "#141b30"
                                border.width: 1
                                border.color: "#25304b"

                                Text {
                                    id: backendBadgeLabel
                                    anchors.centerIn: parent
                                    text: "Usando " + (window.controller ? window.controller.currentBackendLabel : "CLI")
                                    color: "#e8eefc"
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

                                SuggestionCard {
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 118
                                    icon: modelData.icon
                                    title: modelData.title
                                    subtitle: modelData.subtitle
                                    prompt: modelData.prompt
                                    onClicked: {
                                        promptInput.text = modelData.prompt
                                        promptInput.forceActiveFocus()
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
                                radius: 24
                                color: role === "user"
                                    ? "#dbe6ff"
                                    : role === "system"
                                        ? "#18213b"
                                        : "#141b30"
                                border.width: 1
                                border.color: role === "user"
                                    ? "#b2c8ff"
                                    : role === "system"
                                        ? "#36466f"
                                        : "#243150"

                                Column {
                                    id: bubbleColumn
                                    x: 16
                                    y: 14
                                    width: bubbleBox.width - 32
                                    spacing: 6

                                    Text {
                                        text: meta
                                        color: role === "user" ? "#365ab5" : "#90a4ca"
                                        font.pixelSize: 12
                                        font.weight: Font.Medium
                                        font.family: window.bodyFont
                                    }

                                    Text {
                                        width: parent.width
                                        text: content
                                        color: role === "user" ? "#0f172a" : "#f8fbff"
                                        font.pixelSize: 14
                                        wrapMode: Text.Wrap
                                        font.family: window.bodyFont
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
                    implicitHeight: 194
                    radius: 30
                    color: "#31111a2a"
                    border.width: 1
                    border.color: "#243150"

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 10

                            Rectangle {
                                radius: 16
                                color: "#12192d"
                                border.width: 1
                                border.color: "#232f4d"
                                implicitHeight: 44
                                implicitWidth: backendRow.implicitWidth + 10

                                RowLayout {
                                    id: backendRow
                                    anchors.centerIn: parent
                                    spacing: 6

                                    Repeater {
                                        model: window.backends

                                        CapsuleButton {
                                            label: modelData === "codex" ? "Codex" : "Qwen"
                                            active: window.controller && window.controller.selectedBackend === modelData
                                            enabled: !!window.controller
                                            onClicked: window.controller.selectedBackend = modelData
                                        }
                                    }
                                }
                            }

                            CapsuleButton {
                                label: window.controller && window.controller.bridgeStatus === "ready" ? "Reconectar" : "Conectar"
                                enabled: !!window.controller
                                onClicked: window.controller.connectBackend()
                            }

                            CapsuleButton {
                                label: "Parar"
                                enabled: window.controller && window.controller.canStop
                                onClicked: window.controller.stopSession()
                            }

                            CapsuleButton {
                                label: "/model"
                                enabled: window.controller && window.controller.canSend
                                onClicked: window.controller.sendQuickCommand("/model")
                            }

                            CapsuleButton {
                                label: "/reset"
                                enabled: window.controller && window.controller.canSend
                                onClicked: window.controller.sendQuickCommand("/reset")
                            }

                            Item { Layout.fillWidth: true }

                            Text {
                                text: "Enter para enviar"
                                color: "#8397c0"
                                font.pixelSize: 12
                                font.family: window.bodyFont
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            radius: 24
                            color: "#0c1222"
                            border.width: 1
                            border.color: "#27324f"

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
                                        placeholderTextColor: "#7182a7"
                                        color: "#f8fbff"
                                        selectionColor: "#7aa2ff"
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
                                        color: "#879abf"
                                        font.pixelSize: 13
                                        elide: Text.ElideRight
                                        font.family: window.bodyFont
                                    }
                                }

                                CapsuleButton {
                                    label: "Enviar"
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
