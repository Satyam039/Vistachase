import re

with open('backend/src/lib/whatsapp/whatsapp.provider.ts', 'r') as f:
    content = f.read()

# Replace the text message with the template message format
whatsapp_template = """          type: "template",
          template: {
            name: "vista_chase_pickup",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: payload.customerName },
                  { type: "text", text: payload.tourName },
                  { type: "text", text: payload.pickupLocation },
                  { type: "text", text: payload.pickupTime },
                  { type: "text", text: payload.vehicleName },
                  { type: "text", text: payload.driverName },
                  { type: "text", text: payload.trackingUrl }
                ]
              }
            ]
          }"""

content = re.sub(r'          type: "text",\n          text: \{[\s\S]*?`\$\{payload\.trackingUrl\}`,\n          \},', whatsapp_template.strip() + ',', content)

with open('backend/src/lib/whatsapp/whatsapp.provider.ts', 'w') as f:
    f.write(content)

