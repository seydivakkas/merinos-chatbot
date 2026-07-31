"""LangGraph import shim.

Uses the real LangGraph package when installed. The compact fallback implements
only the StateGraph surface used by this demo so tests can run in restricted
environments. Production deployments must install the declared langgraph
package.
"""
from __future__ import annotations

import inspect
from typing import Any, Callable

try:  # pragma: no cover - exercised in full dependency environments
    from langgraph.graph import END, START, StateGraph as StateGraph
    USING_REAL_LANGGRAPH = True
except ImportError:  # pragma: no cover - fallback is covered in this environment
    START = "__start__"
    END = "__end__"
    USING_REAL_LANGGRAPH = False

    class _CompiledGraph:
        def __init__(self, nodes: dict[str, Callable], edges: dict[str, list[str]], conditionals: dict[str, tuple[Callable, dict[str, str]]]) -> None:
            self.nodes = nodes
            self.edges = edges
            self.conditionals = conditionals

        async def ainvoke(self, input_state: dict[str, Any], config: dict[str, Any] | None = None) -> dict[str, Any]:
            state = dict(input_state)
            next_nodes = self.edges.get(START, [])
            if len(next_nodes) != 1:
                raise RuntimeError("Fallback StateGraph requires exactly one START edge.")
            current = next_nodes[0]
            transitions = 0
            while current != END:
                transitions += 1
                if transitions > 100:
                    raise RuntimeError("Fallback StateGraph recursion limit exceeded.")
                node = self.nodes[current]
                output = node(state)
                if inspect.isawaitable(output):
                    output = await output
                if output:
                    state.update(output)
                if current in self.conditionals:
                    condition, mapping = self.conditionals[current]
                    route = condition(state)
                    current = mapping[route]
                    continue
                targets = self.edges.get(current, [])
                if len(targets) != 1:
                    raise RuntimeError(f"Fallback StateGraph node {current!r} must have exactly one outgoing edge.")
                current = targets[0]
            return state

    class StateGraph:
        def __init__(self, state_type: Any) -> None:
            self.nodes: dict[str, Callable] = {}
            self.edges: dict[str, list[str]] = {}
            self.conditionals: dict[str, tuple[Callable, dict[str, str]]] = {}

        def add_node(self, name: str, node: Callable) -> None:
            self.nodes[name] = node

        def add_edge(self, source: str, target: str) -> None:
            self.edges.setdefault(source, []).append(target)

        def add_conditional_edges(self, source: str, condition: Callable, mapping: dict[str, str]) -> None:
            self.conditionals[source] = (condition, mapping)

        def compile(self, checkpointer: Any | None = None) -> _CompiledGraph:
            return _CompiledGraph(self.nodes, self.edges, self.conditionals)
