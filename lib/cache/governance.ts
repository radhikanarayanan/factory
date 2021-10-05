import { govnSvcHealth as health } from "./deps.ts";

export interface TextKeyProxy<Resource> {
  [key: string]: Resource;
}

export interface CacheHealthKeyNameTransformer {
  (keyName: string): string;
}

export interface CacheHealth {
  (keyName: CacheHealthKeyNameTransformer): health.ServiceHealthComponents;
}

export interface ModelProxyStrategyResult {
  readonly isConstructFromOrigin: boolean;
  readonly proxyRemarks: string;
}

export interface ModelProxyStrategy {
  (): Promise<ModelProxyStrategyResult>;
}

export interface ModelProxyState {
  readonly proxyStrategyResult: ModelProxyStrategyResult;
}

export interface ModelProxyIssue extends ModelProxyState {
  readonly originNotAvailable: boolean;
  readonly proxyOriginError?: Error;
}

export type ProxyableModel<Model> = () => Promise<Model>;

export interface ProxyableModelLifecycle<
  Model,
  OriginContext,
  StrategyResult = ModelProxyStrategyResult,
  State = ModelProxyState,
  Issue = ModelProxyIssue,
> {
  readonly isOriginAvailable: (
    psr: StrategyResult,
  ) => Promise<OriginContext | false>;
  readonly constructFromOrigin: (
    oc: OriginContext,
    sr: StrategyResult,
  ) => Promise<Model>;
  readonly constructFromError: (issue: Issue) => Promise<Model>;
  readonly constructFromProxy: (proxied: State) => Promise<Model>;
  readonly persistProxied: (
    model: Model,
    psr: StrategyResult,
    oc: OriginContext,
  ) => Promise<Model>;
}

export interface FileSysModelProxyStrategyResult
  extends ModelProxyStrategyResult {
  readonly proxyFilePathAndName: string;
  readonly proxyFileInfo?: Deno.FileInfo;
}

export interface FileSysModelProxyStrategy {
  (proxyFilePathAndName: string): Promise<FileSysModelProxyStrategyResult>;
}

export interface FileSysModelProxyState extends ModelProxyState {
  readonly proxyStrategyResult: FileSysModelProxyStrategyResult;
}

// deno-lint-ignore no-empty-interface
export interface ProxyableFileSysModelLifecycle<
  Model,
  OriginContext,
> extends
  ProxyableModelLifecycle<
    Model,
    OriginContext,
    FileSysModelProxyStrategyResult,
    FileSysModelProxyState
  > {
}

export interface ProxyableFileSysModelArguments<Model, OriginContext>
  extends
    ProxyableFileSysModelLifecycle<
      Model,
      OriginContext
    > {
  readonly proxyFilePathAndName: string;
  readonly proxyStrategy: FileSysModelProxyStrategy;
}

export interface FileSysDirectoryProxyStrategyResult
  extends ModelProxyStrategyResult {
  readonly proxyPath: string;
  readonly proxyPathInfo?: Deno.FileInfo;
}

export interface FileSysDirectoryProxyStrategy {
  (proxyPath: string): Promise<FileSysDirectoryProxyStrategyResult>;
}
