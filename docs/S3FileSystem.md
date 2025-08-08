# S3FileSystem 🪣

*"Because sometimes your files need to live in the cloud, and sometimes your developers need to pretend they're still on disk."*

The S3FileSystem provides a filesystem interface for AWS S3 (and S3-compatible) storage services. Think of it as your files living in the cloud while your code thinks they're still in good old-fashioned folders. It's like having a distributed hard drive that you can access from anywhere - as long as you have internet and sufficient AWS permissions.

## What It Solves 

If you've ever found yourself:

- **Abstracting cloud storage**: Writing file operations that work both locally and in S3
- **Migrating to cloud storage**: Moving from local files to S3 without rewriting application logic
- **Building cloud-native apps**: Creating applications that naturally work with object storage
- **Handling distributed file systems**: Managing files across multiple environments
- **Testing with cloud storage**: Mocking S3 operations in your development workflow

Then S3FileSystem is your new best friend. It provides the familiar filesystem interface while handling all the S3 complexities behind the scenes.

## Core Features 

### Cloud-Native File Operations

```typescript
// Write to S3 like it's a local file
fs.writeFileSync('documents/report.pdf', pdfContent);

// Read from S3 like it's local
const content = fs.readFileSync('documents/report.pdf');

// List S3 "directories" 
const files = fs.readDirSync('documents/');
```

### Smart Caching System

- **In-memory content cache**: Frequently accessed files stay in memory
- **Metadata caching**: File stats and existence checks are cached
- **Cache invalidation**: Automatic cache updates on write operations
- **Performance optimization**: Reduces S3 API calls and latency

### Path Normalization

```typescript
// All of these work identically
fs.readFile('./config/settings.json')
fs.readFile('/config/settings.json')  
fs.readFile('config/settings.json')
```

### Content Type Detection

```typescript
// Automatically sets correct Content-Type
fs.writeFile('data.json', jsonString);     // → application/json
fs.writeFile('image.png', imageBuffer);    // → image/png
fs.writeFile('unknown.xyz', content);      // → application/octet-stream
```

### Prefix Support

```typescript
// Namespace your files with bucket prefixes
const fs = new S3FileSystem({
  bucket: 'my-app-storage',
  prefix: 'production/uploads/'
});

// Files are stored at: s3://my-app-storage/production/uploads/...
```

## Usage Examples 

### Basic Setup

```typescript
import { S3FileSystem } from '@synet/fs/s3';

// Simple configuration
const s3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'my-app-bucket'
});

// With authentication
const s3fs = new S3FileSystem({
  region: 'us-east-1', 
  bucket: 'my-secure-bucket',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// With prefix and custom endpoint (for S3-compatible services)
const s3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'my-bucket',
  prefix: 'app-data/',
  endpoint: 'https://s3.example.com',
  forcePathStyle: true
});
```

### File Operations

```typescript
// Write files to S3
s3fs.writeFileSync('config/app.json', JSON.stringify(config));
s3fs.writeFileSync('logs/error.log', errorMessage);

// Read files from S3  
const config = JSON.parse(s3fs.readFileSync('config/app.json'));
const logs = s3fs.readFileSync('logs/error.log');

// Check if files exist
if (s3fs.existsSync('config/feature-flags.json')) {
  const flags = JSON.parse(s3fs.readFileSync('config/feature-flags.json'));
}

// Delete files
s3fs.deleteFileSync('temp/old-data.json');
```

### Directory Operations

```typescript
// List directory contents
const configFiles = s3fs.readDirSync('config/');
console.log(configFiles); // ['app.json', 'database.json', 'secrets/']

// Create directory structure (no-op in S3, but maintains interface)
s3fs.ensureDirSync('uploads/images/');

// Delete entire directories
s3fs.deleteDirSync('temp/');
```

### File Statistics

```typescript
// Get file metadata
const stats = s3fs.statSync('uploads/photo.jpg');
console.log(`File size: ${stats.size} bytes`);
console.log(`Last modified: ${stats.mtime}`);
console.log(`ETag: ${stats.etag}`);
console.log(`Is file: ${stats.isFile()}`);
```

### Async Operations

```typescript
import { S3FileSystem } from '@synet/fs/promises/s3';

const s3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'async-bucket'
});

// All operations are async
await s3fs.writeFile('data.json', jsonData);
const content = await s3fs.readFile('data.json');
const files = await s3fs.readDir('uploads/');
const stats = await s3fs.stat('important.pdf');
```

### Cache Management

```typescript
// Clear all cached data
s3fs.clearCache();

// Check bucket configuration
const info = s3fs.getBucketInfo();
console.log(`Bucket: ${info.bucket}`);
console.log(`Region: ${info.region}`); 
console.log(`Prefix: ${info.prefix}`);
```

### Error Handling

```typescript
try {
  const content = s3fs.readFileSync('missing-file.txt');
} catch (error) {
  if (error.message.includes('File not found')) {
    console.log('File does not exist in S3');
  } else {
    console.error('S3 operation failed:', error.message);
  }
}
```

## Configuration Options 🔧

```typescript
interface S3FileSystemOptions {
  /** AWS region (required) */
  region: string;
  
  /** S3 bucket name (required) */
  bucket: string;
  
  /** AWS access key ID (optional, uses default credentials if not provided) */
  accessKeyId?: string;
  
  /** AWS secret access key (optional) */
  secretAccessKey?: string;
  
  /** AWS session token for temporary credentials (optional) */
  sessionToken?: string;
  
  /** Base prefix for all operations - acts as root directory (optional) */
  prefix?: string;
  
  /** S3 endpoint URL for S3-compatible services (optional) */
  endpoint?: string;
  
  /** Force path-style URLs instead of virtual-hosted-style (optional) */
  forcePathStyle?: boolean;
}
```

## API Reference 📖

### IFileSystem Methods (Sync)

```typescript
class S3FileSystem implements IFileSystem {
  // File operations
  existsSync(path: string): boolean
  readFileSync(path: string): string
  writeFileSync(path: string, data: string): void
  deleteFileSync(path: string): void
  
  // Directory operations  
  readDirSync(path: string): string[]
  ensureDirSync(path: string): void
  deleteDirSync(path: string): void
  
  // File metadata
  statSync(path: string): FileStats
  
  // Permissions (no-op for S3)
  chmodSync(path: string, mode: number): void
}
```

### IAsyncFileSystem Methods (Async)

```typescript
class S3FileSystem implements IAsyncFileSystem {
  // File operations
  exists(path: string): Promise<boolean>
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  deleteFile(path: string): Promise<void>
  
  // Directory operations
  readDir(path: string): Promise<string[]>
  ensureDir(path: string): Promise<void>
  deleteDir(path: string): Promise<void>
  
  // File metadata
  stat(path: string): Promise<FileStats>
  
  // Permissions (no-op for S3)
  chmod(path: string, mode: number): Promise<void>
}
```

### Additional Methods

```typescript
// Cache management
clearCache(): void

// Configuration info
getBucketInfo(): { bucket: string; region: string; prefix: string }
```

## Performance Considerations 

### Caching Strategy

- **Memory usage**: Files are cached in memory - monitor usage for large files
- **Cache invalidation**: Writing to a file clears its cache entry
- **TTL**: Cache entries currently don't expire (manual clearCache() required)

### Network Optimization

- **Batch operations**: Consider grouping multiple file operations
- **Regional proximity**: Choose regions close to your application
- **Connection pooling**: AWS SDK handles connection reuse automatically

### Cost Optimization

- **Read operations**: Cached reads don't incur additional S3 costs
- **List operations**: Directory listings can be expensive for large prefixes
- **Transfer costs**: Consider data transfer costs between regions

## Best Practices 

### Authentication

```typescript
// Use IAM roles in production (no hardcoded keys)
const s3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'production-bucket'
  // Credentials automatically loaded from IAM role
});

// Use environment variables for development
const s3fs = new S3FileSystem({
  region: process.env.AWS_REGION,
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
```

### Path Organization

```typescript
// Use prefixes for logical separation
const userFs = new S3FileSystem({
  bucket: 'app-storage',
  prefix: `users/${userId}/`
});

const tempFs = new S3FileSystem({
  bucket: 'app-storage', 
  prefix: 'temp/'
});
```

### Error Handling

```typescript
// Always handle S3 errors gracefully
try {
  const content = await s3fs.readFile('important.json');
  return JSON.parse(content);
} catch (error) {
  if (error.message.includes('File not found')) {
    return getDefaultConfig();
  }
  throw new Error(`Failed to load config: ${error.message}`);
}
```

### Memory Management

```typescript
// Clear cache periodically for long-running applications
setInterval(() => {
  s3fs.clearCache();
}, 60 * 60 * 1000); // Every hour

// Or clear cache after processing large files
await s3fs.writeFile('large-data.json', bigJsonString);
s3fs.clearCache(); // Free up memory
```

## Testing 

### Mocking S3 Operations

```typescript
import { vi } from 'vitest';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  // ... other commands
}));

// Test your code with mocked S3
const s3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'test-bucket'
});
```

### Integration Testing

```typescript
// Use a test bucket for integration tests
const testS3fs = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'my-app-test-bucket',
  prefix: `test-run-${Date.now()}/`
});

// Clean up after tests
afterAll(async () => {
  await testS3fs.deleteDir(''); // Delete all test files
});
```

## Common Patterns 

### Configuration File Management

```typescript
class S3ConfigManager {
  constructor(private s3fs: S3FileSystem) {}
  
  async loadConfig<T>(name: string, defaultValue: T): Promise<T> {
    try {
      const content = await this.s3fs.readFile(`config/${name}.json`);
      return JSON.parse(content);
    } catch (error) {
      if (error.message.includes('File not found')) {
        await this.saveConfig(name, defaultValue);
        return defaultValue;
      }
      throw error;
    }
  }
  
  async saveConfig<T>(name: string, config: T): Promise<void> {
    await this.s3fs.writeFile(`config/${name}.json`, JSON.stringify(config, null, 2));
  }
}
```

### File Upload Handler

```typescript
class S3FileUploader {
  constructor(private s3fs: S3FileSystem) {}
  
  async uploadFile(key: string, content: string, metadata?: Record<string, any>): Promise<string> {
    // Add timestamp and metadata
    const enrichedKey = `uploads/${new Date().getFullYear()}/${Date.now()}-${key}`;
  
    await this.s3fs.writeFile(enrichedKey, content);
  
    // Store metadata separately
    if (metadata) {
      await this.s3fs.writeFile(`${enrichedKey}.meta`, JSON.stringify(metadata));
    }
  
    return enrichedKey;
  }
  
  async getFileWithMetadata(key: string): Promise<{ content: string; metadata?: any }> {
    const content = await this.s3fs.readFile(key);
  
    let metadata;
    try {
      const metaContent = await this.s3fs.readFile(`${key}.meta`);
      metadata = JSON.parse(metaContent);
    } catch {
      // Metadata file doesn't exist
    }
  
    return { content, metadata };
  }
}
```

---

> Call me crazy, but I think it’s going to work this time.

$ whoami
0en