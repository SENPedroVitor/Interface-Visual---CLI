from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from waddle.provider_settings import ProviderSettingsService

try:
    from PySide6.QtCore import (
        QAbstractListModel,
        QModelIndex,
        QObject,
        Property,
        Qt,
        Signal,
        Slot,
    )
except ImportError:  # pragma: no cover - lets non-Qt service tests import package
    class QObject:  # type: ignore
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

    class QAbstractListModel(QObject):  # type: ignore
        pass

    class QModelIndex:  # type: ignore
        def isValid(self) -> bool:
            return False

    class Qt:  # type: ignore
        class ItemDataRole:
            UserRole = 256
            DisplayRole = 0

    def Property(*args: Any, **kwargs: Any):  # type: ignore
        def decorator(fn: Any) -> Any:
            return fn

        return decorator

    def Signal(*args: Any, **kwargs: Any):  # type: ignore
        class _Signal:
            def connect(self, *args: Any, **kwargs: Any) -> None:
                pass

            def emit(self, *args: Any, **kwargs: Any) -> None:
                pass

        return _Signal()

    def Slot(*args: Any, **kwargs: Any):  # type: ignore
        return lambda fn: fn

from .service import DesktopRuntimeService


class _DictListModel(QAbstractListModel):
    role_map: dict[int, str] = {}

    def __init__(self) -> None:
        super().__init__()
        self._items: list[dict[str, Any]] = []

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._items)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid() or index.row() >= len(self._items):
            return None
        key = self.role_map.get(role)
        return self._items[index.row()].get(key) if key else None

    def roleNames(self) -> dict[int, bytes]:
        return {role: name.encode("utf-8") for role, name in self.role_map.items()}

    def replace(self, items: list[dict[str, Any]]) -> None:
        self.beginResetModel()
        self._items = list(items)
        self.endResetModel()

    def append(self, item: dict[str, Any]) -> None:
        self.beginInsertRows(QModelIndex(), len(self._items), len(self._items))
        self._items.append(dict(item))
        self.endInsertRows()

    def clear(self) -> None:
        self.replace([])


class AgentListModel(_DictListModel):
    IdRole = Qt.ItemDataRole.UserRole + 1
    NameRole = Qt.ItemDataRole.UserRole + 2
    RoleRole = Qt.ItemDataRole.UserRole + 3
    DescriptionRole = Qt.ItemDataRole.UserRole + 4
    StatusRole = Qt.ItemDataRole.UserRole + 5
    ProviderRole = Qt.ItemDataRole.UserRole + 6
    AccentRole = Qt.ItemDataRole.UserRole + 7
    PreviewRole = Qt.ItemDataRole.UserRole + 8
    LastActivityRole = Qt.ItemDataRole.UserRole + 9
    role_map = {
        IdRole: "id",
        NameRole: "name",
        RoleRole: "role",
        DescriptionRole: "description",
        StatusRole: "status",
        ProviderRole: "provider_id",
        AccentRole: "accent",
        PreviewRole: "preview",
        LastActivityRole: "last_activity_at",
    }


class MessageListModel(_DictListModel):
    IdRole = Qt.ItemDataRole.UserRole + 1
    SenderRole = Qt.ItemDataRole.UserRole + 2
    SenderNameRole = Qt.ItemDataRole.UserRole + 3
    AgentKeyRole = Qt.ItemDataRole.UserRole + 4
    KindRole = Qt.ItemDataRole.UserRole + 5
    ContentRole = Qt.ItemDataRole.UserRole + 6
    TimestampRole = Qt.ItemDataRole.UserRole + 7
    IsUserRole = Qt.ItemDataRole.UserRole + 8
    role_map = {
        IdRole: "id",
        SenderRole: "sender",
        SenderNameRole: "sender_name",
        AgentKeyRole: "agent_key",
        KindRole: "kind",
        ContentRole: "content",
        TimestampRole: "timestamp",
        IsUserRole: "is_user",
    }


class ProviderListModel(_DictListModel):
    IdRole = Qt.ItemDataRole.UserRole + 1
    NameRole = Qt.ItemDataRole.UserRole + 2
    KindRole = Qt.ItemDataRole.UserRole + 3
    AvailableRole = Qt.ItemDataRole.UserRole + 4
    ConfiguredRole = Qt.ItemDataRole.UserRole + 5
    SelectedRole = Qt.ItemDataRole.UserRole + 6
    DetailRole = Qt.ItemDataRole.UserRole + 7
    SelectedModelRole = Qt.ItemDataRole.UserRole + 8
    MaskedKeyRole = Qt.ItemDataRole.UserRole + 9
    role_map = {
        IdRole: "id",
        NameRole: "name",
        KindRole: "kind",
        AvailableRole: "available",
        ConfiguredRole: "configured",
        SelectedRole: "selected",
        DetailRole: "detail",
        SelectedModelRole: "selected_model_id",
        MaskedKeyRole: "masked_key",
    }


class ProviderModelListModel(_DictListModel):
    IdRole = Qt.ItemDataRole.UserRole + 1
    NameRole = Qt.ItemDataRole.UserRole + 2
    TagRole = Qt.ItemDataRole.UserRole + 3
    DescriptionRole = Qt.ItemDataRole.UserRole + 4
    SelectedRole = Qt.ItemDataRole.UserRole + 5
    role_map = {
        IdRole: "id",
        NameRole: "name",
        TagRole: "tag",
        DescriptionRole: "description",
        SelectedRole: "selected",
    }


class DesktopController(QObject):
    agentsModelChanged = Signal()
    messagesModelChanged = Signal()
    providersModelChanged = Signal()
    providerModelsModelChanged = Signal()
    selectedAgentChanged = Signal()
    selectedProviderChanged = Signal()
    selectedModelChanged = Signal()
    statusTextChanged = Signal()
    errorTextChanged = Signal()
    credentialStatusTextChanged = Signal()
    isRunningChanged = Signal()
    canSendChanged = Signal()
    serviceEvent = Signal("QVariant")
    serviceStatus = Signal("QVariant")

    def __init__(
        self,
        *,
        db_path: Optional[str | Path] = None,
        provider_settings: Optional[ProviderSettingsService] = None,
    ) -> None:
        super().__init__()
        self._agents_model = AgentListModel()
        self._messages_model = MessageListModel()
        self._providers_model = ProviderListModel()
        self._provider_models_model = ProviderModelListModel()
        self._selected_agent = "Quinta"
        self._selected_provider_id = ""
        self._selected_model_id = ""
        self._status_text = "Pronto"
        self._error_text = ""
        self._credential_status_text = ""
        self._is_running = False
        self.service = DesktopRuntimeService(
            db_path=db_path,
            provider_settings=provider_settings,
            on_event=self.serviceEvent.emit,
            on_status=self.serviceStatus.emit,
        )
        self.serviceEvent.connect(self._on_service_event)
        self.serviceStatus.connect(self._on_service_status)
        self.refresh()

    @Property(QObject, notify=agentsModelChanged)
    def agentsModel(self) -> QObject:
        return self._agents_model

    @Property(QObject, notify=messagesModelChanged)
    def messagesModel(self) -> QObject:
        return self._messages_model

    @Property(QObject, notify=providersModelChanged)
    def providersModel(self) -> QObject:
        return self._providers_model

    @Property(QObject, notify=providerModelsModelChanged)
    def providerModelsModel(self) -> QObject:
        return self._provider_models_model

    @Property(str, notify=selectedAgentChanged)
    def selectedAgentName(self) -> str:
        return self._selected_agent

    @Property(str, notify=selectedProviderChanged)
    def selectedProviderId(self) -> str:
        return self._selected_provider_id

    @Property(str, notify=selectedModelChanged)
    def selectedModelId(self) -> str:
        return self._selected_model_id

    @Property(str, notify=statusTextChanged)
    def statusText(self) -> str:
        return self._status_text

    @Property(str, notify=errorTextChanged)
    def errorText(self) -> str:
        return self._error_text

    @Property(str, notify=credentialStatusTextChanged)
    def credentialStatusText(self) -> str:
        return self._credential_status_text

    @Property(bool, notify=isRunningChanged)
    def isRunning(self) -> bool:
        return self._is_running

    @Property(bool, notify=canSendChanged)
    def canSend(self) -> bool:
        return not self._is_running

    @Slot()
    def refresh(self) -> None:
        self._agents_model.replace(self.service.list_agents())
        self._load_provider_state()
        self._load_history()

    @Slot(str)
    def selectAgent(self, name: str) -> None:
        try:
            self.service.select_agent(name)
        except ValueError as exc:
            self._set_error(str(exc))
            return
        if self._selected_agent != name:
            self._selected_agent = name
            self.selectedAgentChanged.emit()
        self._load_history()

    @Slot()
    def refreshProviders(self) -> None:
        self._load_provider_state()

    @Slot(str)
    def selectProvider(self, provider_id: str) -> None:
        try:
            state = self.service.select_provider_model(provider_id)
        except Exception as exc:
            self._set_error(str(exc))
            return
        self._apply_provider_state(state)
        self._agents_model.replace(self.service.list_agents())
        self._set_credential_status("")

    @Slot(str, str)
    def selectProviderModel(self, provider_id: str, model_id: str) -> None:
        try:
            state = self.service.select_provider_model(provider_id or self._selected_provider_id, model_id)
        except Exception as exc:
            self._set_error(str(exc))
            return
        self._apply_provider_state(state)
        self._agents_model.replace(self.service.list_agents())
        self._set_credential_status("")

    @Slot(str, str)
    def saveProviderCredential(self, provider_id: str, api_key: str) -> None:
        provider = provider_id or self._selected_provider_id
        secret = str(api_key or "").strip()
        if not provider:
            self._set_error("Escolha um provedor.")
            return
        try:
            self.service.save_provider_credential(
                provider,
                secret,
                model_id=self._selected_model_id or None,
            )
            self._apply_provider_state(self.service.get_provider_state())
            self._agents_model.replace(self.service.list_agents())
        except Exception as exc:
            self._set_error(str(exc))
            return
        self._set_error("")
        self._set_credential_status("Credencial salva no armazenamento protegido.")

    @Slot(str)
    def sendPrompt(self, text: str) -> None:
        prompt = (text or "").strip()
        if not prompt or self._is_running:
            return
        self._messages_model.append(
            {
                "id": f"user-{datetime.now().timestamp()}",
                "sender": "user",
                "sender_name": "Voce",
                "agent_key": self._selected_agent.lower(),
                "kind": "message",
                "content": prompt,
                "timestamp": datetime.now().strftime("%H:%M"),
                "is_user": True,
            }
        )
        self._set_error("")
        try:
            self.service.submit_prompt(prompt, self._selected_agent)
        except Exception as exc:
            self._set_running(False)
            self._set_error(str(exc))

    @Slot()
    def cancelRun(self) -> None:
        if not self.service.cancel_active():
            self._set_status("Nada em execucao.")

    @Slot()
    def shutdown(self) -> None:
        self.service.shutdown()

    @Slot("QVariant")
    def _on_service_event(self, payload: dict[str, Any]) -> None:
        if payload.get("type") == "agent.message":
            message = payload.get("desktop_message") or {}
            if self._message_belongs_to_selection(message):
                self._messages_model.append(message)
        elif payload.get("type") == "agent.status_change":
            data = payload.get("data") or {}
            name = data.get("agent_name") or payload.get("source") or "Agente"
            status = data.get("new_status") or ""
            self._set_status(f"{name}: {status}")
        self._agents_model.replace(self.service.list_agents())

    @Slot("QVariant")
    def _on_service_status(self, payload: dict[str, Any]) -> None:
        status = str(payload.get("status") or "")
        message = str(payload.get("message") or "")
        self._set_running(status in {"running", "cancelling"})
        if message:
            self._set_status(message)
        if status in {"completed", "cancelled", "failed"}:
            self._agents_model.replace(self.service.list_agents())
            if status == "failed":
                self._set_error(message)

    def _load_history(self) -> None:
        self._messages_model.replace(self.service.list_history(self._selected_agent))
        self.messagesModelChanged.emit()

    def _load_provider_state(self) -> None:
        try:
            self._apply_provider_state(self.service.get_provider_state())
        except Exception as exc:
            self._set_error(str(exc))

    def _apply_provider_state(self, state: dict[str, Any]) -> None:
        self._providers_model.replace(list(state.get("providers") or []))
        self._provider_models_model.replace(list(state.get("models") or []))
        self.providersModelChanged.emit()
        self.providerModelsModelChanged.emit()
        self._set_selected_provider(str(state.get("selected_provider_id") or ""))
        self._set_selected_model(str(state.get("selected_model_id") or ""))

    def _message_belongs_to_selection(self, message: dict[str, Any]) -> bool:
        selected = self._selected_agent.lower()
        return selected in {
            str(message.get("agent_key") or "").lower(),
            str(message.get("sender_name") or "").lower(),
            str(message.get("sender") or "").lower(),
        }

    def _set_status(self, value: str) -> None:
        if self._status_text != value:
            self._status_text = value
            self.statusTextChanged.emit()

    def _set_error(self, value: str) -> None:
        if self._error_text != value:
            self._error_text = value
            self.errorTextChanged.emit()

    def _set_credential_status(self, value: str) -> None:
        if self._credential_status_text != value:
            self._credential_status_text = value
            self.credentialStatusTextChanged.emit()

    def _set_selected_provider(self, value: str) -> None:
        if self._selected_provider_id != value:
            self._selected_provider_id = value
            self.selectedProviderChanged.emit()

    def _set_selected_model(self, value: str) -> None:
        if self._selected_model_id != value:
            self._selected_model_id = value
            self.selectedModelChanged.emit()

    def _set_running(self, value: bool) -> None:
        if self._is_running != value:
            self._is_running = value
            self.isRunningChanged.emit()
            self.canSendChanged.emit()
