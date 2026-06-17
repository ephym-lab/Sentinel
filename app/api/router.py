from fastapi import APIRouter
from app.api.routes import (
    user_routes,
    tenant_routes,
    camera_routes,
    poi_routes,
    surveillance_routes,
    incident_routes,
    person_routes,
    detection_routes,
    auth_routes,
    platform_routes,
)

api_router = APIRouter()

# Public/Shared Schema routes
api_router.include_router(user_routes.router, prefix="/users", tags=["Users"])
api_router.include_router(tenant_routes.router, prefix="/tenants", tags=["Tenants"])
api_router.include_router(auth_routes.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(platform_routes.router, prefix="/platform", tags=["Platform Administration"])

# Tenant-specific schema routes (require X-Tenant-ID header)
api_router.include_router(camera_routes.router, prefix="/cameras", tags=["Cameras"])
api_router.include_router(poi_routes.router, prefix="/pois", tags=["Persons of Interest"])
api_router.include_router(person_routes.router, prefix="/persons", tags=["Persons"])
api_router.include_router(detection_routes.router, prefix="/detections", tags=["Edge Ingestion"])
api_router.include_router(surveillance_routes.router, prefix="/surveillance", tags=["Surveillance Ingestion"])
api_router.include_router(incident_routes.router, prefix="/incidents", tags=["Incidents"])


