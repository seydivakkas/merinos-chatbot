"""PostgreSQL-compatible SQLAlchemy models for auth, orders, chat and admin."""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from .config import Settings
from .demo_repository import data
from .auth import hash_password

class Base(DeclarativeBase): pass

def now() -> datetime: return datetime.now(UTC)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32), default="viewer", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class OrderRecord(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(Text)
    estimated_date: Mapped[str] = mapped_column(String(128))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_code: Mapped[str] = mapped_column(String(64))
    product_name: Mapped[str] = mapped_column(String(256))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    order: Mapped[OrderRecord] = relationship(back_populates="items")

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    channel: Mapped[str] = mapped_column(String(32), default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    intent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content_redacted: Mapped[str] = mapped_column(Text, default="[not stored]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    conversation: Mapped[Conversation] = relationship(back_populates="messages")

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    source: Mapped[str] = mapped_column(String(256))
    content_version: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class ChatbotConfig(Base):
    __tablename__ = "chatbot_configs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    value_json: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class Database:
    def __init__(self, url: str) -> None:
        if url.startswith("sqlite"):
            db_path = url.split("///", 1)[-1]
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(url, pool_pre_ping=True, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)
    def init(self) -> None: Base.metadata.create_all(self.engine)
    def session(self) -> Iterator[Session]:
        with self.session_factory() as session: yield session
    def seed(self, settings: Settings) -> None:
        with self.session_factory() as session:
            if session.scalar(select(User).where(User.email == settings.admin_email)) is None:
                session.add(User(email=settings.admin_email, password_hash=hash_password(settings.admin_password), role="admin", is_active=True))
            if session.scalar(select(ChatbotConfig).where(ChatbotConfig.key == "runtime")) is None:
                session.add(ChatbotConfig(key="runtime", value_json={"enabled": True, "dataSource": "demo", "maxPlanSteps": 4}))
            if session.scalar(select(OrderRecord.id).limit(1)) is None:
                for index, order in enumerate(data()["orders"]):
                    record = OrderRecord(order_number=order["number"], status=order["status"], summary=order["summary"], estimated_date=order["estimatedDate"], is_demo=True)
                    record.items.append(OrderItem(product_code=data()["products"][index]["code"], product_name=data()["products"][index]["name"], quantity=1))
                    session.add(record)
            if session.scalar(select(KnowledgeDocument.id).limit(1)) is None:
                for faq in data()["faqs"]:
                    session.add(KnowledgeDocument(title=faq["question"], source=faq["source"], content_version=faq["contentVersion"], status=faq["status"], metadata_json={"faqId": faq["id"], "topic": faq["topic"]}))
            session.commit()
