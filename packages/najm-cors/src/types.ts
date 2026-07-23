
export interface CorsOptions {
   origin?: string | string[];
   allowMethods?: string[];
   allowHeaders?: string[];
   exposeHeaders?: string[];
   maxAge?: number;
   credentials?: boolean;
}

export interface CorsDecoratorOptions extends CorsOptions {
   disabled?: boolean;
}

export type CorsPluginConfig = boolean | CorsOptions | null | undefined;



