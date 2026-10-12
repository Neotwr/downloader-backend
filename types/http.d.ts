export declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer;
  }
}

export declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}