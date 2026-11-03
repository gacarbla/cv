/**
 * Punto de entrada de la librería: reexporta sus piezas.
 * Library entry point: re-exports its pieces.
 */
export { Computed, Signal, Store } from "./signal.js";
export type { Listener, Unsubscribe } from "./signal.js";
export { h, isVComponent, isVElement, keyOf, norm, tx } from "./vdom.js";
export type {
  AnyCtor,
  Attrs,
  AttrValue,
  EventHandler,
  Key,
  RefFn,
  StyleValue,
  VChild,
  VComponent,
  VElement,
  VNode,
  VNorm,
} from "./vdom.js";
export { Component, mount } from "./component.js";
export { bodyOf, component, mountLayout, mountPage } from "./loader.js";
export type { ComponentDef, ComponentOpts, SetupCtx } from "./loader.js";
export { COLLECT_EVENT, collectFrom, provideValue } from "./forms.js";
export type { CollectDetail } from "./forms.js";
export { createStrategy, resolveTransition, routeEvent, Router } from "./router.js";
export type {
  CurrentRoute,
  HashStrategyOptions,
  LocaleSource,
  MemoryStrategyOptions,
  PathStrategyOptions,
  RouteDef,
  RouteModule,
  RouterOptions,
  RouteStrategy,
  StrategyKind,
  StrategyOptions,
  TransitionDef,
  TransitionFn,
  TransitionName,
} from "./router.js";
export { RouteBuilder, Routes } from "./routes.js";
export { App } from "./app.js";
export type { AppOptions } from "./app.js";
export { I18n } from "./i18n.js";
export type { I18nOptions } from "./i18n.js";
