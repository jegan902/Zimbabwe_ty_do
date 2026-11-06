export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, "AUTHENTICATION_ERROR", message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, "AUTHORIZATION_ERROR", message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `${resource} không tồn tại`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message: string = "Số dư không đủ") {
    super(402, "INSUFFICIENT_FUNDS", message);
    Object.setPrototypeOf(this, InsufficientFundsError.prototype);
  }
}

export class InsufficientSupplierBalanceError extends AppError {
  constructor(message: string = "Số dư nhà cung cấp không đủ") {
    super(409, "SUPPLIER_INSUFFICIENT_BALANCE", message);
    Object.setPrototypeOf(this, InsufficientSupplierBalanceError.prototype);
  }
}

export class PriceChangedError extends AppError {
  constructor(details: { oldPrice: string; newPrice: string; unitCost: string }) {
    super(
      409,
      "PRICE_CHANGED",
      "Giá sản phẩm vừa thay đổi, vui lòng xác nhận giá mới",
      details
    );
    Object.setPrototypeOf(this, PriceChangedError.prototype);
  }
}

export class SupplierError extends AppError {
  constructor(
    message: string,
    code: string = "SUPPLIER_ERROR",
    public raw?: unknown
  ) {
    super(502, code, message, raw);
    Object.setPrototypeOf(this, SupplierError.prototype);
  }
}

export class SupplierUnavailableError extends AppError {
  constructor(message: string = "Nhà cung cấp tạm thời không phản hồi") {
    super(503, "SUPPLIER_UNAVAILABLE", message);
    Object.setPrototypeOf(this, SupplierUnavailableError.prototype);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(500, "INTERNAL_SERVER_ERROR", message);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}