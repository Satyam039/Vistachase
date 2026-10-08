import crypto from "crypto";

export class BokunApiClient {
  private accessKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(accessKey: string, secretKey: string, baseUrl = "https://api.bokun.io") {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
  }

  private generateSignature(dateStr: string, httpMethod: string, uri: string): string {
    const stringToSign = `${dateStr}${this.accessKey}${httpMethod}${uri}`;
    const hmac = crypto.createHmac("sha1", this.secretKey);
    hmac.update(stringToSign);
    return hmac.digest("base64");
  }

  public async fetch(method: "GET" | "POST" | "PUT" | "DELETE", endpoint: string, body?: any) {
    const date = new Date();
    // Bókun requires Date in YYYY-MM-DD HH:MM:SS format
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

    const signature = this.generateSignature(dateStr, method, endpoint);

    const headers: Record<string, string> = {
      "X-Bokun-AccessKey": this.accessKey,
      "X-Bokun-Date": dateStr,
      "X-Bokun-Signature": signature,
      "Accept": "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json;charset=UTF-8";
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Bókun API Error: ${res.status} ${res.statusText} - ${text}`);
        }

        if (res.status === 204) return null;
        return await res.json();
      } catch (err: any) {
        retries--;
        console.warn(`Bókun API fetch failed: ${err.message}. Retries left: ${retries}`);
        if (retries === 0) throw err;
        // exponential backoff
        await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
      }
    }
  }

  public async getProducts() {
    return this.fetch("POST", "/activity.json/search?lang=EN&currency=CAD", {});
  }

  public async getAvailabilities(activityId: string, start: string, end: string) {
    return this.fetch("GET", `/activity.json/${activityId}/availabilities?start=${start}&end=${end}`);
  }

}
