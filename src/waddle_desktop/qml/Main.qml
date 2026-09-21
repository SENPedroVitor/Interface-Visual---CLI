import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window

ApplicationWindow {
    id: window
    width: 1180
    height: 820
    minimumWidth: 900
    minimumHeight: 620
    visible: true
    title: "Waddle"
    color: "#17161d"

    property var controller: (typeof desktopController !== "undefined") ? desktopController : null
    property color bgApp: "#17161d"
    property color bgSidebar: "#1c1b24"
    property color bgMain: "#1c1b24"
    property color bgInput: "#232230"
    property color bgHover: "#262530"
    property color bgSelected: "#2d2b38"
    property color textPrimary: "#efeef5"
    property color textSecondary: "#b8b5c4"
    property color textMuted: "#918e9f"
    property color border: Qt.rgba(1, 1, 1, 0.08)
    property color accent: "#9159fe"

    function submitComposer() {
        if (!controller || !controller.canSend) return
        var text = composer.text.trim()
        if (text.length === 0) return
        controller.sendPrompt(text)
        composer.text = ""
    }

    Rectangle {
        anchors.fill: parent
        color: bgApp

        RowLayout {
            anchors.fill: parent
            spacing: 0

            Rectangle {
                Layout.preferredWidth: 280
                Layout.fillHeight: true
                color: bgSidebar
                border.color: border

                ColumnLayout {
                    anchors.fill: parent
                    spacing: 0

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 58
                        Layout.leftMargin: 16
                        Layout.rightMargin: 12
                        spacing: 8

                        Rectangle {
                            width: 22
                            height: 22
                            radius: 11
                            color: "#18181b"
                            Rectangle {
                                anchors.centerIn: parent
                                width: 8
                                height: 8
                                radius: 4
                                color: accent
                            }
                        }

                        Text {
                            text: "Waddle"
                            color: textPrimary
                            font.pixelSize: 14
                            font.weight: Font.DemiBold
                            Layout.fillWidth: true
                        }

                        Button {
                            text: "+"
                            implicitWidth: 34
                            implicitHeight: 34
                            enabled: false
                            ToolTip.visible: hovered
                            ToolTip.text: "Criacao fica pendente para a proxima fatia"
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.margins: 12
                        Layout.preferredHeight: 38
                        radius: 10
                        color: bgHover
                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            spacing: 8
                            Text { text: "\u2315"; color: textMuted; font.pixelSize: 16 }
                            Text {
                                text: "Buscar agentes"
                                color: textMuted
                                font.pixelSize: 13
                                Layout.fillWidth: true
                            }
                        }
                    }

                    ListView {
                        id: agentList
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 4
                        leftMargin: 12
                        rightMargin: 12
                        model: controller ? controller.agentsModel : null

                        delegate: ItemDelegate {
                            id: row
                            width: agentList.width - agentList.leftMargin - agentList.rightMargin
                            height: 62
                            highlighted: controller && controller.selectedAgentName === model.name
                            onClicked: controller.selectAgent(model.name)
                            background: Rectangle {
                                radius: 12
                                color: row.highlighted ? bgSelected : (row.hovered ? bgHover : "transparent")
                                border.color: row.highlighted ? Qt.rgba(0.57, 0.35, 1, 0.35) : "transparent"
                            }
                            contentItem: RowLayout {
                                spacing: 10
                                Rectangle {
                                    width: 36
                                    height: 36
                                    radius: 18
                                    color: model.accent
                                    opacity: 0.95
                                    Text {
                                        anchors.centerIn: parent
                                        text: model.name ? model.name.charAt(0) : "?"
                                        color: "white"
                                        font.weight: Font.DemiBold
                                    }
                                }
                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    Text {
                                        text: model.name
                                        color: textPrimary
                                        font.pixelSize: 13
                                        font.weight: Font.DemiBold
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                    Text {
                                        text: model.status !== "idle" ? model.status : (model.preview || model.role)
                                        color: textSecondary
                                        font.pixelSize: 12
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                                Text {
                                    text: model.provider_id
                                    color: textMuted
                                    font.pixelSize: 10
                                }
                            }
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 54
                        color: "transparent"
                        border.color: border
                        Text {
                            anchors.centerIn: parent
                            width: parent.width - 24
                            text: controller ? controller.statusText : "Runtime indisponivel"
                            color: textSecondary
                            font.pixelSize: 12
                            elide: Text.ElideRight
                            horizontalAlignment: Text.AlignHCenter
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                color: bgMain

                ColumnLayout {
                    anchors.fill: parent
                    spacing: 0

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 64
                        color: Qt.rgba(0.09, 0.08, 0.11, 0.82)
                        border.color: border

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 24
                            anchors.rightMargin: 20
                            spacing: 12
                            Rectangle {
                                width: 34
                                height: 34
                                radius: 17
                                color: accent
                                Text {
                                    anchors.centerIn: parent
                                    text: controller ? controller.selectedAgentName.charAt(0) : "W"
                                    color: "white"
                                    font.weight: Font.DemiBold
                                }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 1
                                Text {
                                    text: controller ? controller.selectedAgentName : "Waddle"
                                    color: textPrimary
                                    font.pixelSize: 15
                                    font.weight: Font.DemiBold
                                }
                                Text {
                                    text: controller && controller.isRunning ? "Trabalhando fora da thread da interface" : "Historico SQLite e runtime Python direto"
                                    color: textSecondary
                                    font.pixelSize: 12
                                }
                            }
                            Button {
                                text: "Parar"
                                enabled: controller && controller.isRunning
                                onClicked: controller.cancelRun()
                            }
                        }
                    }

                    ListView {
                        id: messages
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 12
                        topMargin: 28
                        bottomMargin: 20
                        model: controller ? controller.messagesModel : null
                        onCountChanged: Qt.callLater(positionViewAtEnd)

                        delegate: Item {
                            width: messages.width
                            height: bubble.implicitHeight
                            Rectangle {
                                id: bubble
                                width: Math.min(720, messages.width - 96)
                                implicitHeight: messageColumn.implicitHeight + 22
                                x: model.is_user ? messages.width - width - 48 : 48
                                radius: 14
                                color: model.is_user ? "#372f57" : "#232230"
                                border.color: model.is_user ? "transparent" : border
                                ColumnLayout {
                                    id: messageColumn
                                    anchors.fill: parent
                                    anchors.margins: 11
                                    spacing: 5
                                    RowLayout {
                                        Layout.fillWidth: true
                                        Text {
                                            text: model.sender_name || ""
                                            color: model.is_user ? "white" : textPrimary
                                            font.pixelSize: 12
                                            font.weight: Font.DemiBold
                                        }
                                        Item { Layout.fillWidth: true }
                                        Text {
                                            text: model.timestamp || ""
                                            color: model.is_user ? Qt.rgba(1, 1, 1, 0.72) : textMuted
                                            font.pixelSize: 11
                                        }
                                    }
                                    Text {
                                        Layout.fillWidth: true
                                        text: model.content
                                        color: model.is_user ? "white" : textPrimary
                                        wrapMode: Text.Wrap
                                        font.pixelSize: 14
                                        lineHeight: 1.25
                                    }
                                }
                            }
                        }

                        Label {
                            anchors.centerIn: parent
                            visible: messages.count === 0
                            width: Math.min(500, parent.width - 64)
                            text: "Escolha um agente e envie uma mensagem para iniciar esta fatia nativa."
                            color: textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.Wrap
                            font.pixelSize: 15
                        }
                    }

                    Label {
                        Layout.fillWidth: true
                        Layout.leftMargin: 24
                        Layout.rightMargin: 24
                        visible: controller && controller.errorText.length > 0
                        text: controller ? controller.errorText : ""
                        color: "#dc7b73"
                        font.pixelSize: 12
                        horizontalAlignment: Text.AlignHCenter
                    }

                    Rectangle {
                        Layout.alignment: Qt.AlignHCenter
                        Layout.fillWidth: true
                        Layout.maximumWidth: 760
                        Layout.leftMargin: 24
                        Layout.rightMargin: 24
                        Layout.bottomMargin: 24
                        Layout.preferredHeight: Math.max(56, composer.implicitHeight + 22)
                        radius: 18
                        color: bgInput
                        border.color: composer.activeFocus ? Qt.rgba(0.57, 0.35, 1, 0.45) : border

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 14
                            anchors.rightMargin: 10
                            anchors.topMargin: 8
                            anchors.bottomMargin: 8
                            spacing: 8

                            TextArea {
                                id: composer
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                placeholderText: controller && controller.isRunning ? "Aguarde a resposta..." : "Mensagem"
                                color: textPrimary
                                placeholderTextColor: textMuted
                                background: null
                                wrapMode: TextEdit.Wrap
                                enabled: controller && controller.canSend
                                Keys.onPressed: function(event) {
                                    if (event.key === Qt.Key_Return && !(event.modifiers & Qt.ShiftModifier)) {
                                        event.accepted = true
                                        submitComposer()
                                    }
                                }
                            }

                            Button {
                                text: controller && controller.isRunning ? "..." : "\u2191"
                                enabled: controller && controller.canSend && composer.text.trim().length > 0
                                implicitWidth: 36
                                implicitHeight: 36
                                onClicked: submitComposer()
                            }
                        }
                    }
                }
            }
        }
    }
}
