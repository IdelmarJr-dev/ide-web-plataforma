import type { Response } from 'express';

const HTTP_OK = 200;

export abstract class BaseController {
  protected handleSuccess(res: Response, data: unknown, statusCode: number = HTTP_OK): void {
    res.status(statusCode).json({ data });
  }
}
