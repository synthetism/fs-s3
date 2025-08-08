import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { FileStats, IAsyncFileSystem } from "./filesystem.interface";

/**
 * S3 filesystem configuration options
 */
export interface S3FileSystemOptions {
  /** AWS region */
  region: string;
  /** S3 bucket name */
  bucket: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
  /** AWS session token (for temporary credentials) */
  sessionToken?: string;
  /** Base prefix for all operations (acts as root directory) */
  prefix?: string;
  /** S3 endpoint URL (for S3-compatible services) */
  endpoint?: string;
  /** Force path style URLs */
  forcePathStyle?: boolean;
}

/**
 * In-memory cache for file metadata and content
 */
interface S3FileCache {
  content?: string;
  size: number;
  lastModified: Date;
  etag: string;
}

/**
 * Async S3-based filesystem implementation
 *
 * Provides filesystem operations on AWS S3 or S3-compatible storage.
 * Each file operation corresponds to S3 object operations.
 * Directories are handled virtually through object key prefixes.
 */
export class S3FileSystem implements IAsyncFileSystem {
  private s3: S3Client;
  private options: Required<
    Omit<
      S3FileSystemOptions,
      | "accessKeyId"
      | "secretAccessKey"
      | "sessionToken"
      | "endpoint"
      | "forcePathStyle"
    >
  > &
    Pick<
      S3FileSystemOptions,
      | "accessKeyId"
      | "secretAccessKey"
      | "sessionToken"
      | "endpoint"
      | "forcePathStyle"
    >;
  private cache = new Map<string, S3FileCache>();

  constructor(options: S3FileSystemOptions) {
    this.options = {
      prefix: "",
      ...options,
    };

    this.s3 = new S3Client({
      region: this.options.region,
      credentials:
        this.options.accessKeyId && this.options.secretAccessKey
          ? {
              accessKeyId: this.options.accessKeyId,
              secretAccessKey: this.options.secretAccessKey,
              sessionToken: this.options.sessionToken,
            }
          : undefined,
      endpoint: this.options.endpoint,
      forcePathStyle: this.options.forcePathStyle,
    });
  }

  /**
   * Check if a file exists in S3
   * @param path File path in the bucket
   */
  async exists(path: string): Promise<boolean> {
    try {
      const key = this.getS3Key(path);

      // Check cache first
      if (this.cache.has(key)) {
        return true;
      }

      // Check S3
      const response = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        }),
      );

      if (response) {
        // Cache metadata
        this.cache.set(key, {
          size: response.ContentLength || 0,
          lastModified: response.LastModified || new Date(),
          etag: response.ETag || "",
        });
        return true;
      }

      return false;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw new Error(`Failed to check file existence for ${path}: ${error}`);
    }
  }

  /**
   * Read a file from S3
   * @param path File path in the bucket
   */
  async readFile(path: string): Promise<string> {
    try {
      const key = this.getS3Key(path);

      // Check cache first
      const cached = this.cache.get(key);
      if (cached?.content) {
        return cached.content;
      }

      // Fetch from S3
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        }),
      );

      // Handle empty files - response.Body might be undefined or empty
      const content = response.Body
        ? await this.bodyToString(response.Body)
        : "";

      // Cache the file
      this.cache.set(key, {
        content,
        size: response.ContentLength || content.length,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || "",
      });

      return content;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        throw new Error(`File not found: ${path}`);
      }
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  /**
   * Write a file to S3
   * @param path File path in the bucket
   * @param data File content
   */
  async writeFile(path: string, data: string): Promise<void> {
    if (data === undefined || data === null) {
      throw new Error("Data parameter is required");
    }

    try {
      const key = this.getS3Key(path);

      const response = await this.s3.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
          Body: data,
          ContentType: this.getContentType(path),
        }),
      );

      // Update cache
      this.cache.set(key, {
        content: data,
        size: Buffer.byteLength(data, "utf8"),
        lastModified: new Date(),
        etag: response.ETag || "",
      });
    } catch (error: unknown) {
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Delete a file from S3
   * @param path File path in the bucket
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const key = this.getS3Key(path);

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        }),
      );

      // Remove from cache
      this.cache.delete(key);
    } catch (error: unknown) {
      // S3 delete is idempotent - doesn't fail if object doesn't exist
      // But we still remove from cache just in case
      this.cache.delete(this.getS3Key(path));
    }
  }

  /**
   * Delete a directory (delete all objects with prefix)
   * @param path Directory path
   */
  async deleteDir(path: string): Promise<void> {
    try {
      const prefix = this.getS3Key(path);
      const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

      // List all objects with the prefix
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: normalizedPrefix,
        }),
      );

      if (!response.Contents || response.Contents.length === 0) {
        return; // Nothing to delete
      }

      // Delete each object
      for (const object of response.Contents) {
        if (object.Key) {
          await this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.options.bucket,
              Key: object.Key,
            }),
          );

          // Remove from cache
          this.cache.delete(object.Key);
        }
      }
    } catch (error: unknown) {
      throw new Error(`Failed to delete directory ${path}: ${error}`);
    }
  }

  /**
   * Ensure a directory exists (no-op for S3)
   * @param dirPath Directory path
   */
  async ensureDir(dirPath: string): Promise<void> {
    // S3 doesn't have directories - they're implicit through object keys
    // This is a no-op for compatibility
  }

  /**
   * Read directory contents
   * @param dirPath Directory path
   */
  async readDir(dirPath: string): Promise<string[]> {
    try {
      const prefix = this.getS3Key(dirPath);
      const normalizedPrefix =
        prefix === "" ? "" : prefix.endsWith("/") ? prefix : `${prefix}/`;

      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: normalizedPrefix,
          Delimiter: "/",
        }),
      );

      const files: string[] = [];

      // Add files (objects)
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key !== normalizedPrefix) {
            const fileName = object.Key.replace(normalizedPrefix, "");
            if (fileName && !fileName.includes("/")) {
              files.push(fileName);
            }
          }
        }
      }

      // Add directories (common prefixes)
      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          if (commonPrefix.Prefix) {
            const dirName = commonPrefix.Prefix.replace(
              normalizedPrefix,
              "",
            ).replace("/", "");
            if (dirName) {
              files.push(`${dirName}/`);
            }
          }
        }
      }

      return files;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return [];
      }
      throw new Error(`Failed to read directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Set object permissions (S3 ACL - simplified implementation)
   * @param path File path
   * @param mode Permission mode (simplified to public/private)
   */
  async chmod(path: string, mode: number): Promise<void> {
    // S3 doesn't have traditional file permissions
    // This could be extended to set ACLs, but for simplicity we'll make it a no-op
    // In a real implementation, you might use PutObjectAclCommand
  }

  /**
   * Get file statistics
   * @param path File path
   */
  async stat(path: string): Promise<FileStats> {
    try {
      const key = this.getS3Key(path);

      // Check cache first
      const cached = this.cache.get(key);
      if (cached) {
        return this.createFileStats(cached.size, cached.lastModified, false);
      }

      // Fetch metadata from S3
      const response = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
        }),
      );

      const size = response.ContentLength || 0;
      const lastModified = response.LastModified || new Date();

      // Cache metadata
      this.cache.set(key, {
        size,
        lastModified,
        etag: response.ETag || "",
      });

      return this.createFileStats(size, lastModified, false);
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        throw new Error(`File not found: ${path}`);
      }
      throw new Error(`Failed to get file stats for ${path}: ${error}`);
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get S3 bucket information
   */
  getBucketInfo(): { bucket: string; region: string; prefix: string } {
    return {
      bucket: this.options.bucket,
      region: this.options.region,
      prefix: this.options.prefix,
    };
  }

  /**
   * Get full S3 key from filesystem path
   * @param path Filesystem path
   */
  private getS3Key(path: string): string {
    // Remove leading slashes and normalize
    const normalizedPath = path.replace(/^\.?\/+/, "").replace(/\/+/g, "/");

    // Apply prefix if configured
    if (this.options.prefix) {
      const normalizedPrefix = this.options.prefix.replace(/^\/+|\/+$/g, "");
      return normalizedPrefix
        ? `${normalizedPrefix}/${normalizedPath}`
        : normalizedPath;
    }

    return normalizedPath;
  }

  /**
   * Get content type based on file extension
   * @param path File path
   */
  private getContentType(path: string): string {
    const ext = path.toLowerCase().split(".").pop();
    const contentTypes: Record<string, string> = {
      json: "application/json",
      txt: "text/plain",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      xml: "application/xml",
      md: "text/markdown",
    };
    return contentTypes[ext || ""] || "application/octet-stream";
  }

  /**
   * Check if error is a "not found" error
   * @param error Error object
   */
  private isNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    // Check for AWS SDK NoSuchKey error
    if ("name" in error && (error as { name: string }).name === "NoSuchKey") {
      return true;
    }

    // Check for HTTP 404 status
    if (
      "$metadata" in error &&
      typeof (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata === "object" &&
      (error as { $metadata: { httpStatusCode?: number } }).$metadata
        .httpStatusCode === 404
    ) {
      return true;
    }

    return false;
  }

  /**
   * Convert AWS SDK response body to string
   * @param body Response body from AWS SDK
   */
  private async bodyToString(body: unknown): Promise<string> {
    // Handle null/undefined/empty body
    if (!body) {
      return "";
    }

    // AWS SDK v3 body can be a Readable stream, Blob, or other types
    if (
      body &&
      typeof body === "object" &&
      "transformToString" in body &&
      typeof (body as { transformToString: () => Promise<string> })
        .transformToString === "function"
    ) {
      // For modern AWS SDK v3, use transformToString if available
      const result = await (
        body as { transformToString: () => Promise<string> }
      ).transformToString();
      return result || "";
    }

    // Handle as Node.js stream
    if (body && typeof body === "object" && "pipe" in body) {
      const chunks: Buffer[] = [];
      const stream = body as NodeJS.ReadableStream;

      return new Promise((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const result = Buffer.concat(chunks).toString("utf8");
          resolve(result || "");
        });
        stream.on("error", reject);
      });
    }

    // Fallback: try to convert to string directly
    if (typeof body === "string") {
      return body;
    }

    if (body instanceof Uint8Array) {
      const result = Buffer.from(body).toString("utf8");
      return result || "";
    }

    throw new Error("Unsupported body type for conversion to string");
  }

  /**
   * Create file statistics object
   * @param size File size in bytes
   * @param lastModified Last modified date
   * @param isDirectory Is the file a directory
   */
  private createFileStats(
    size: number,
    lastModified: Date,
    isDirectory: boolean,
  ): FileStats {
    return {
      isFile: () => !isDirectory,
      isDirectory: () => isDirectory,
      isSymbolicLink: () => false, // S3 doesn't support symlinks
      size,
      mtime: lastModified,
      ctime: lastModified, // S3 doesn't have separate creation time
      atime: lastModified, // S3 doesn't track access time
      mode: 0o644, // Default permissions for S3 objects
    };
  }
}

/**
 * Create a new async S3 filesystem instance
 * @param options S3 filesystem configuration
 */
export function createS3FileSystem(options: S3FileSystemOptions): S3FileSystem {
  return new S3FileSystem(options);
}
