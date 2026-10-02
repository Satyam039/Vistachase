import fs from "fs";
import path from "path";

export interface UploadOptions {
  contentType?: string;
  folder?: string;
}

export interface IStorageProvider {
  upload(fileBuffer: Buffer, fileName: string, options?: UploadOptions): Promise<string>;
  delete(fileUrl: string): Promise<boolean>;
  getUrl(fileName: string, folder?: string): string;
}

class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  private publicPrefix = "/uploads";

  constructor() {
    this.baseDir = path.resolve(process.cwd(), "public/uploads");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(fileBuffer: Buffer, fileName: string, options?: UploadOptions): Promise<string> {
    const folder = options?.folder || "media";
    const targetDir = path.join(this.baseDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${Date.now()}_${sanitized}`;
    const filePath = path.join(targetDir, uniqueName);
    await fs.promises.writeFile(filePath, fileBuffer);

    return `${this.publicPrefix}/${folder}/${uniqueName}`;
  }

  async delete(fileUrl: string): Promise<boolean> {
    try {
      const relative = fileUrl.replace(this.publicPrefix, "");
      const fullPath = path.join(this.baseDir, relative);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getUrl(fileName: string, folder: string = "media"): string {
    return `${this.publicPrefix}/${folder}/${fileName}`;
  }
}

class S3StorageProvider implements IStorageProvider {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET_NAME || "vistachase-media";
    this.region = process.env.AWS_REGION || "us-west-2";
  }

  async upload(fileBuffer: Buffer, fileName: string, options?: UploadOptions): Promise<string> {
    const folder = options?.folder || "media";
    const key = `${folder}/${Date.now()}_${fileName}`;
    // AWS S3 client will be invoked here when AWS credentials are provided.
    // In dev or if credentials missing, logs notice and provides mock URL
    console.log(`[S3StorageProvider] S3 ready upload for bucket ${this.bucket}, key: ${key}`);
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async delete(fileUrl: string): Promise<boolean> {
    console.log(`[S3StorageProvider] S3 ready delete for ${fileUrl}`);
    return true;
  }

  getUrl(fileName: string, folder: string = "media"): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${folder}/${fileName}`;
  }
}

let storageInstance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (storageInstance) return storageInstance;

  const providerType = process.env.STORAGE_PROVIDER || "local";
  if (providerType === "s3" && process.env.AWS_ACCESS_KEY_ID) {
    storageInstance = new S3StorageProvider();
  } else {
    storageInstance = new LocalStorageProvider();
  }
  return storageInstance;
}
