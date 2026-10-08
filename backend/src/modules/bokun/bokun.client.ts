import crypto from "crypto";

export class BokunApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

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

    // Only reads are retried: repeating a POST after a timeout could create a second booking.
    let attempts = method === "GET" ? 3 : 1;
    while (true) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(20_000),
        });

        if (!res.ok) {
          const text = await res.text();
          const error = new BokunApiError(res.status, `Bókun API Error: ${res.status} ${res.statusText} - ${text.slice(0, 500)}`);
          if (res.status < 500) attempts = 1; // a refused request won't succeed on retry
          throw error;
        }

        if (res.status === 204) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } catch (err: any) {
        attempts--;
        if (attempts <= 0) throw err;
        console.warn(`Bókun API fetch failed: ${err.message}. Retries left: ${attempts}`);
        await new Promise((resolve) => setTimeout(resolve, (3 - attempts) * 1000));
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
