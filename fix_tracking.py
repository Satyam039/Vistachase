import re

with open('backend/src/lib/tracking/tracking.provider.ts', 'r') as f:
    content = f.read()

# Make it use a real tracking provider if NODE_ENV == 'production', but since we need it in production:
# Actually we can just modify MockLiveTrackingProvider to read from VehiclePosition if available.
real_logic = """
    // 2. Telemetry: Read from real VehiclePosition table first!
    const latestPos = vehicle.id ? await prisma.vehiclePosition.findFirst({
      where: { vehicleId: vehicle.id },
      orderBy: { recordedAt: "desc" }
    }) : null;
    
    let currentLat = startPoint.latitude;
    let currentLng = startPoint.longitude;
    let speed = 72;
    
    if (latestPos) {
       currentLat = latestPos.latitude;
       currentLng = latestPos.longitude;
       speed = latestPos.speedKmh || 0;
    } else {
       // Fallback to interpolated progress for demo if no GPS ping
       currentLat = startPoint.latitude + (targetPoint.latitude - startPoint.latitude) * progress;
       currentLng = startPoint.longitude + (targetPoint.longitude - startPoint.longitude) * progress;
    }
"""

content = re.sub(r'    const currentLat = startPoint\.latitude \+ \(targetPoint\.latitude - startPoint\.latitude\) \* progress;\n    const currentLng = startPoint\.longitude \+ \(targetPoint\.longitude - startPoint\.longitude\) \* progress;', real_logic.strip(), content)

content = content.replace('status === "SHUTTLE_IS_HERE" ? 0 : 72', 'speed')

with open('backend/src/lib/tracking/tracking.provider.ts', 'w') as f:
    f.write(content)
