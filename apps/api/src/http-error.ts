export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message: string): HttpError {
    return new HttpError(400, "bad_request", message);
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, "not_found", message);
  }
}
