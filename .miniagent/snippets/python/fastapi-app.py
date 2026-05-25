"""
FastAPI 应用模板
"""
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
import time
from typing import AsyncGenerator

# 本地导入
from routers import api_router
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    应用生命周期管理

    启动前执行初始化，关闭时执行清理
    """
    logger.info("Application starting up")
    yield
    logger.info("Application shutting down")


def create_app() -> FastAPI:
    """
    创建并配置 FastAPI 应用
    """
    app = FastAPI(
        title=settings.APP_NAME,
        description=settings.APP_DESCRIPTION,
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    # CORS 配置
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 健康检查端点
    @app.get("/health", status_code=status.HTTP_200_OK, tags=["health"])
    async def health_check() -> dict:
        """
        健康检查端点
        """
        logger.info("Health check requested")
        return {
            "status": "healthy",
            "app_name": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    # 日志中间件
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """
        记录请求日志
        """
        start_time = time.perf_counter()
        logger.info(f"Request started: {request.method} {request.url}")

        response = await call_next(request)

        process_time = time.perf_counter() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(
            f"Request completed: {request.method} {request.url} - "
            f"Status: {response.status_code} - "
            f"Duration: {process_time:.4f}s"
        )
        return response

    # 全局异常处理器
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logger.warning(
            f"HTTP Exception: {request.method} {request.url} - Status: {exc.status_code} - Detail: {exc.detail}"
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": exc.detail,
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled Exception: {request.method} {request.url}",
            exc_info=exc,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal server error",
            },
        )

    # 路由注册
    app.include_router(api_router, prefix=settings.API_PREFIX)

    logger.info("Application created")
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
