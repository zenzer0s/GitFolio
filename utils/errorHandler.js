// Add to utils/errorHandler.js
class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  exports.catchAsync = fn => {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  };
  
  exports.globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  };