import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window

    width: 1400
    height: 920
    minimumWidth: 1180
    minimumHeight: 760
    visible: true
    title: "Osaurus Native"
    color: "#0d1530"
    property string displayFont: "SF Pro Display"
    property string bodyFont: "SF Pro Text"

    property var backends: ["codex", "qwen"]
    property var starterCards: [
        { icon: "i", title: "Explicar um conceito", subtitle: "Clareza rapida para ideias complexas.", prompt: "Explique este conceito de forma clara e pratica." },
        { icon: "S", title: "Resumir um texto", subtitle: "Compactar conteudo em pontos objetivos.", prompt: "Resuma o texto abaixo em pontos curtos e objetivos." },
        { icon: "</>", title: "Escrever codigo", subtitle: "Comecar uma implementacao limpa.", prompt: "Escreva uma implementacao limpa para este problema." },
        { icon: "Aa", title: "Ajudar a escrever", subtitle: "Lapidar estrutura, tom e clareza.", prompt: "Me ajude a estruturar este texto com mais clareza." }
    ]

    function submitPrompt() {
        if (promptInput.text.trim().length === 0) {
            return
        }

        chatController.sendPrompt(promptInput.text)
        promptInput.text = ""
    }

    component ChipButton: Rectangle {
        id: chip

        property string label: ""
        property bool active: false
        property bool prominent: false
        signal clicked()

        implicitWidth: chipText.implicitWidth + 30
        implicitHeight: 40
        radius: 14
        color: !chip.enabled
            ? "#0bffffff"
            : chip.prominent
                ? "#f8fafc"
                : chip.active
                    ? "#27395f"
                    : chipArea.containsMouse
                        ? "#18ffffff"
                        : "#10ffffff"
        border.width: 1
        border.color: chip.prominent
            ? "#30ffffff"
            : chip.active
                ? "#7aa2ff"
                : "#16ffffff"
        opacity: chip.enabled ? 1.0 : 0.45
        scale: chipArea.pressed ? 0.985 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 100 }
        }

        MouseArea {
            id: chipArea
            anchors.fill: parent
            enabled: chip.enabled
            hoverEnabled: true
            cursorShape: chip.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: chip.clicked()
        }

        Text {
            id: chipText
            anchors.centerIn: parent
            text: chip.label
            color: chip.prominent ? "#0f172a" : "#f8fafc"
            font.pixelSize: 14
            font.weight: Font.DemiBold
            font.family: window.bodyFont
        }
    }

    component ActionCard: Rectangle {
        id: actionCard

        property string title: ""
        property string subtitle: ""
        property string prompt: ""
        property string icon: ""
        signal clicked()

        radius: 22
        color: actionArea.containsMouse ? "#18ffffff" : "#12ffffff"
        border.width: 1
        border.color: "#18ffffff"
        scale: actionArea.pressed ? 0.99 : 1.0

        Behavior on scale {
            NumberAnimation { duration: 100 }
        }

        MouseArea {
            id: actionArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: actionCard.clicked()
        }

        RowLayout {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 14

            Rectangle {
                Layout.preferredWidth: 38
                Layout.preferredHeight: 38
                radius: 19
                color: "#16ffffff"
                border.width: 1
                border.color: "#20ffffff"

                Text {
                    anchors.centerIn: parent
                    text: actionCard.icon
                    color: "#f8fafc"
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 3

                Text {
                    text: actionCard.title
                    color: "#e8eefc"
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                    font.family: window.bodyFont
                }

                Text {
                    Layout.fillWidth: true
                    text: actionCard.subtitle
                    color: "#9db1d8"
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    font.family: window.bodyFont
                }
            }
        }
    }

    component StatusPill: Rectangle {
        id: statusPill

        property string tone: "idle"
        property string label: ""

        implicitWidth: statusText.implicitWidth + 26
        implicitHeight: 34
        radius: 999
        color: tone === "ready"
            ? "#173426"
            : tone === "starting"
                ? "#4a3515"
                : tone === "error"
                    ? "#4c1f24"
                    : "#10ffffff"
        border.width: 1
        border.color: tone === "ready"
            ? "#2dd4bf"
            : tone === "starting"
                ? "#f59e0b"
                : tone === "error"
                    ? "#f87171"
                    : "#14ffffff"

        Text {
            id: statusText
            anchors.centerIn: parent
            text: statusPill.label
            color: "#f8fafc"
            font.pixelSize: 13
            font.weight: Font.DemiBold
            font.family: window.bodyFont
        }
    }

    background: Rectangle {
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#17163f" }
            GradientStop { position: 0.42; color: "#11245a" }
            GradientStop { position: 1.0; color: "#0a142d" }
        }

        Rectangle {
            width: 720
            height: 720
            radius: 360
            x: window.width * 0.28
            y: -360
            color: "#2297b7ff"
        }

        Rectangle {
            width: 620
            height: 620
            radius: 310
            x: window.width * 0.7
            y: window.height * 0.42
            color: "#16366cff"
        }

        Rectangle {
            width: 520
            height: 520
            radius: 260
            x: -160
            y: window.height - 300
            color: "#185e7acb"
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 18

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 64
            radius: 22
            color: "#12070f22"
            border.width: 1
            border.color: "#12ffffff"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 14

                ColumnLayout {
                    spacing: 1

                    Text {
                        text: "Osaurus Native"
                        color: "#f8fafc"
                        font.pixelSize: 17
                        font.weight: Font.DemiBold
                        font.family: window.displayFont
                    }

                    Text {
                        text: "Codex e Qwen em uma sessao nativa"
                        color: "#9db1d8"
                        font.pixelSize: 11
                        font.family: window.bodyFont
                    }
                }

                Item {
                    Layout.fillWidth: true
                }

                ChipButton {
                    label: chatController.currentBackendLabel
                    active: true
                }

                StatusPill {
                    label: chatController.statusTitle
                    tone: chatController.bridgeStatus
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: 34
            color: "#cc0b132b"
            border.width: 1
            border.color: "#12ffffff"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 28
                spacing: 18

                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true

                    Column {
                        anchors.centerIn: parent
                        width: 760
                        spacing: 26
                        visible: chatList.count === 0

                        Rectangle {
                            width: 118
                            height: 118
                            radius: 59
                            anchors.horizontalCenter: parent.horizontalCenter
                            color: "#dff4ff"
                            opacity: 0.28

                            Rectangle {
                                anchors.centerIn: parent
                                width: 82
                                height: 82
                                radius: 41
                                color: "#f2fbff"
                                opacity: 0.75

                                Rectangle {
                                    anchors.centerIn: parent
                                    width: 26
                                    height: 26
                                    radius: 13
                                    color: "#9fd5ff"
                                }
                            }
                        }

                        Column {
                            width: parent.width
                            spacing: 8

                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                text: chatController.greeting
                                color: "#f8fafc"
                                font.pixelSize: 60
                                font.weight: Font.Bold
                                font.family: window.displayFont
                            }

                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                text: "Como posso ajudar voce hoje?"
                                color: "#c6d2ea"
                                font.pixelSize: 21
                                font.family: window.bodyFont
                            }

                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                text: "Usando " + chatController.currentBackendLabel
                                color: "#9db1d8"
                                font.pixelSize: 17
                                font.family: window.bodyFont
                            }
                        }

                        GridLayout {
                            width: parent.width
                            columns: 2
                            rowSpacing: 14
                            columnSpacing: 14

                            Repeater {
                                model: window.starterCards

                                ActionCard {
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 92
                                    icon: modelData.icon
                                    title: modelData.title
                                    subtitle: modelData.subtitle
                                    prompt: modelData.prompt
                                    onClicked: promptInput.text = modelData.prompt
                                }
                            }
                        }
                    }

                    ListView {
                        id: chatList
                        anchors.fill: parent
                        model: chatController.messagesModel
                        spacing: 14
                        clip: true
                        visible: count > 0

                        delegate: Item {
                            required property string role
                            required property string content
                            required property string meta

                            width: chatList.width
                            implicitHeight: bubble.implicitHeight + 10

                            Rectangle {
                                id: bubble
                                width: Math.min(chatList.width * 0.78, bubbleColumn.implicitWidth + 34)
                                implicitHeight: bubbleColumn.implicitHeight + 26
                                anchors.right: role === "user" ? parent.right : undefined
                                anchors.left: role === "user" ? undefined : parent.left
                                radius: 22
                                color: role === "user"
                                    ? "#dbeafe"
                                    : role === "system"
                                        ? "#1f2748"
                                        : "#10ffffff"
                                border.width: 1
                                border.color: role === "user"
                                    ? "#93c5fd"
                                    : role === "system"
                                        ? "#4f46e5"
                                        : "#12ffffff"

                                Column {
                                    id: bubbleColumn
                                    x: 14
                                    y: 12
                                    width: Math.min(chatList.width * 0.68, implicitWidth)
                                    spacing: 6

                                    Text {
                                        text: meta
                                        color: role === "user" ? "#1d4ed8" : "#9db1d8"
                                        font.pixelSize: 12
                                    }

                                    Text {
                                        text: content
                                        color: role === "user" ? "#0f172a" : "#f8fafc"
                                        font.pixelSize: 14
                                        wrapMode: Text.WordWrap
                                        width: Math.min(chatList.width * 0.68, implicitWidth)
                                    }
                                }
                            }
                        }

                        ScrollBar.vertical: ScrollBar {
                            policy: ScrollBar.AsNeeded
                        }

                        onCountChanged: positionViewAtEnd()
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: 186
                    radius: 28
                            color: "#0fffffff"
                            border.width: 1
                            border.color: "#14ffffff"

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 10

                            Repeater {
                                model: window.backends

                                ChipButton {
                                    label: modelData === "codex" ? "Codex" : "Qwen"
                                    active: chatController.selectedBackend === modelData
                                    onClicked: chatController.selectedBackend = modelData
                                }
                            }

                            StatusPill {
                                label: chatController.statusTitle
                                tone: chatController.bridgeStatus
                            }

                            ChipButton {
                                label: chatController.bridgeStatus === "ready" ? "Reconectar" : "Conectar"
                                onClicked: chatController.connectBackend()
                            }

                            ChipButton {
                                label: "/model"
                                enabled: chatController.canSend
                                onClicked: chatController.sendQuickCommand("/model")
                            }

                            ChipButton {
                                label: "/reset"
                                enabled: chatController.canSend
                                onClicked: chatController.sendQuickCommand("/reset")
                            }

                            Item {
                                Layout.fillWidth: true
                            }

                            Text {
                                text: "Enter para enviar"
                                color: "#9db1d8"
                                font.pixelSize: 13
                                font.family: window.bodyFont
                            }
                        }

                        TextArea {
                            id: promptInput
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            wrapMode: TextEdit.Wrap
                            placeholderText: "Mensagem para " + chatController.currentBackendLabel + "..."
                            placeholderTextColor: "#7f92b8"
                            color: "#f8fafc"
                            selectionColor: "#60a5fa"
                            font.pixelSize: 19
                            font.family: window.bodyFont
                            padding: 12
                            enabled: chatController.canSend

                            background: Rectangle {
                                radius: 22
                                color: "#0d1530"
                                border.width: 1
                                border.color: "#12ffffff"
                            }

                            Keys.onPressed: function(event) {
                                if ((event.key === Qt.Key_Return || event.key === Qt.Key_Enter)
                                        && !(event.modifiers & Qt.ShiftModifier)) {
                                    event.accepted = true
                                    window.submitPrompt()
                                }
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true

                            Text {
                                text: chatController.statusDescription
                                color: "#91a5ce"
                                font.pixelSize: 13
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                                font.family: window.bodyFont
                            }

                            ChipButton {
                                label: "Enviar"
                                prominent: true
                                enabled: chatController.canSend
                                onClicked: window.submitPrompt()
                            }
                        }
                    }
                }
            }
        }
    }
}
