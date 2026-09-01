export class HttpException extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends HttpException {
  constructor(message = "Bad Request", code = "BAD_REQUEST") {
    super(400, message, code);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(401, message, code);
  }
}

export class ActivateKeyNotFoundException extends HttpException {
  constructor(message = "Active key not found", code = "ACTIVATE_KEY_NOT_FOUND") {
    super(401, message, code);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(403, message, code);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(404, message, code);
  }
}

export class ConflictException extends HttpException {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(409, message, code);
  }
}

export class ToManyRequestException extends HttpException {
  constructor(message = "Too Many Requests", code = "TOO_MANY_REQUESTS") {
    super(429, message, code);
  }
}

export class InternalServerException extends HttpException {
  constructor(
    message = "An unexpected error occurred. Please try again later.",
    code = "INTERNAL_SERVER_ERROR",
  ) {
    super(500, message, code);
  }
}
