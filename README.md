# @synet/fs-s3

**AWS S3 adapter for @synet/fs**

Store files in Amazon S3 with the familiar filesystem interface. Perfect for cloud-native applications that need scalable object storage with intelligent caching and seamless bucket operations.

## Installation

```bash
npm install @synet/fs-s3 @synet/fs
```

## Quick Start

```typescript
import { AsyncFileSystem } from '@synet/fs';
import { S3FileSystem } from '@synet/fs-s3';

// Create S3 adapter
const s3Adapter = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'my-app-files',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Use with AsyncFileSystem
const fs = AsyncFileSystem.create({ adapter: s3Adapter });

// Standard filesystem operations
await fs.writeFile('config.json', JSON.stringify(config));
const data = await fs.readFile('config.json');
const files = await fs.readDir('uploads/');
const exists = await fs.exists('document.pdf');
```

## Configuration

```typescript
interface S3FileSystemOptions {
  region: string;              // AWS region (e.g., 'us-east-1')
  bucket: string;              // S3 bucket name
  accessKeyId?: string;        // AWS access key ID
  secretAccessKey?: string;    // AWS secret access key
  sessionToken?: string;       // AWS session token (for temporary credentials)
  prefix?: string;            // Optional: namespace all files
  endpoint?: string;          // Custom endpoint (for S3-compatible services)
  forcePathStyle?: boolean;   // Force path-style requests (for MinIO, etc.)
  signatureVersion?: string;  // Signature version (default: 'v4')
}
```

## Usage Examples

### Basic Operations

```typescript
import { AsyncFileSystem } from '@synet/fs';
import { S3FileSystem } from '@synet/fs-s3';

const s3Adapter = new S3FileSystem({
  region: 'us-west-2',
  bucket: 'my-documents',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const fs = AsyncFileSystem.create({ adapter: s3Adapter });

// File operations
await fs.writeFile('reports/monthly.pdf', pdfData);
const report = await fs.readFile('reports/monthly.pdf');

// Directory operations
await fs.ensureDir('uploads');
const uploadedFiles = await fs.readDir('uploads');

// Check existence
if (await fs.exists('config/app.json')) {
  const config = JSON.parse(await fs.readFile('config/app.json'));
}
```

### With Prefix (Namespacing)

```typescript
const s3Adapter = new S3FileSystem({
  region: 'eu-west-1',
  bucket: 'shared-storage',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  prefix: 'myapp/' // All files prefixed with 'myapp/'
});

const fs = AsyncFileSystem.create({ adapter: s3Adapter });

// Files stored as: myapp/config.json, myapp/data/users.json
await fs.writeFile('config.json', configData);
await fs.writeFile('data/users.json', userData);
```

### Using IAM Roles (Recommended for Production)

```typescript
// No explicit credentials - uses IAM role or AWS profile
const s3Adapter = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'production-storage'
  // AWS SDK automatically uses IAM role/profile
});
```

### S3-Compatible Services (MinIO, DigitalOcean Spaces)

```typescript
const s3Adapter = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'my-bucket',
  endpoint: 'https://minio.example.com',
  forcePathStyle: true,
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY
});
```

### Cross-Region Replication Setup

```typescript
const primaryS3 = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'primary-storage'
});

const backupS3 = new S3FileSystem({
  region: 'eu-west-1', 
  bucket: 'backup-storage'
});

// Use primary for operations, backup for disaster recovery
const fs = AsyncFileSystem.create({ adapter: primaryS3 });
```

## Multi-Layer Composition

Combine with other filesystem layers for advanced functionality:

```typescript
import { AsyncFileSystem } from '@synet/fs';
import { S3FileSystem } from '@synet/fs-s3';
import { 
  AsyncObservableFileSystem,
  AsyncCachedFileSystem,
  AsyncWithIdFileSystem 
} from '@synet/fs';

const s3Adapter = new S3FileSystem(s3Config);

const fs = AsyncFileSystem.create({
  adapter: new AsyncObservableFileSystem(    // Event monitoring
    new AsyncCachedFileSystem(               // Intelligent caching
      new AsyncWithIdFileSystem(s3Adapter)    // Deterministic IDs
    )
  )
});

// Now you have: S3 storage + caching + observability + ID mapping
```

## Environment Variables

```bash
# Option 1: Explicit credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Option 2: AWS Profile (recommended for development)
AWS_PROFILE=myprofile
AWS_REGION=us-east-1

# Option 3: IAM Role (recommended for production)
AWS_REGION=us-east-1
# No keys needed - uses EC2/ECS/Lambda IAM role

# Option 4: Session token (for temporary credentials)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SESSION_TOKEN=AQoDYXdzEJr...
AWS_REGION=us-east-1
```

## AWS Authentication Methods

### 1. IAM Roles (Recommended for Production)

```typescript
// Works on EC2, ECS, Lambda, EKS
const s3Adapter = new S3FileSystem({
  region: process.env.AWS_REGION,
  bucket: 'production-bucket'
  // AWS SDK automatically uses IAM role
});
```

### 2. AWS Profiles (Recommended for Development)

```typescript
// Uses ~/.aws/credentials profile
const s3Adapter = new S3FileSystem({
  region: process.env.AWS_REGION,
  bucket: 'dev-bucket'
  // AWS SDK uses AWS_PROFILE environment variable
});
```

### 3. Explicit Credentials

```typescript
const s3Adapter = new S3FileSystem({
  region: process.env.AWS_REGION,
  bucket: 'mybucket',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
```

## Testing

```typescript
import { AsyncFileSystem } from '@synet/fs';
import { S3FileSystem } from '@synet/fs-s3';
import { MemFileSystem } from '@synet/fs-memory';

// Production
const s3Fs = AsyncFileSystem.create({ 
  adapter: new S3FileSystem(s3Config) 
});

// Testing - same interface, different storage
const testFs = AsyncFileSystem.create({ 
  adapter: new MemFileSystem() 
});

// Your service works with both
class DocumentService {
  constructor(private fs: AsyncFileSystem) {}
  
  async saveDocument(id: string, content: string) {
    await this.fs.writeFile(`documents/${id}.txt`, content);
  }
}
```

## Features

- **AWS S3 Integration**: Direct integration with Amazon S3 APIs
- **Multi-Region Support**: Deploy across multiple AWS regions
- **IAM Integration**: Full AWS IAM and security support
- **S3-Compatible Services**: Works with MinIO, DigitalOcean Spaces, etc.
- **Intelligent Caching**: Optional intelligent caching layer
- **Content Type Detection**: Automatic MIME type detection
- **Server-Side Encryption**: Support for S3 encryption options
- **Versioning Support**: S3 object versioning integration
- **Lifecycle Policies**: Integration with S3 lifecycle management
- **Prefix Support**: Namespace files within buckets
- **Error Handling**: Comprehensive S3-specific error handling
- **TypeScript**: Full TypeScript support with proper types

## Error Handling

```typescript
try {
  await fs.readFile('nonexistent.txt');
} catch (error) {
  if (error.code === 'NoSuchKey') {
    console.log('File does not exist in S3');
  } else if (error.code === 'AccessDenied') {
    console.log('Permission denied - check IAM permissions');
  } else if (error.code === 'NoSuchBucket') {
    console.log('Bucket does not exist');
  }
}
```

## IAM Policy Example

Minimal IAM policy for your application:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

## Performance Tips

- **Use IAM roles** instead of access keys in production
- **Enable S3 Transfer Acceleration** for global applications
- **Use appropriate storage classes** (Standard, IA, Glacier) based on access patterns
- **Implement intelligent caching** for frequently accessed files
- **Use CloudFront CDN** for public assets
- **Batch operations** when possible to reduce API calls

## S3 Storage Classes

```typescript
// Different storage classes for different use cases
const s3Standard = new S3FileSystem({
  region: 'us-east-1',
  bucket: 'active-data' // Standard storage for frequently accessed data
});

const s3IA = new S3FileSystem({
  region: 'us-east-1', 
  bucket: 'archive-data' // IA storage for infrequently accessed data
});
```

## Related Packages

- **[@synet/fs](https://www.npmjs.com/package/@synet/fs)** - Core filesystem abstraction and Unit Architecture
- **[@synet/fs-azure](https://www.npmjs.com/package/@synet/fs-azure)** - Azure Blob Storage adapter
- **[@synet/fs-gcs](https://www.npmjs.com/package/@synet/fs-gcs)** - Google Cloud Storage adapter
- **[@synet/fs-linode](https://www.npmjs.com/package/@synet/fs-linode)** - Linode Object Storage adapter
- **[@synet/fs-memory](https://www.npmjs.com/package/@synet/fs-memory)** - In-memory storage adapter
- **[@synet/fs-r2](https://www.npmjs.com/package/@synet/fs-r2)** - Cloudflare R2 object storage adapter
- **[@synet/fs-github](https://www.npmjs.com/package/@synet/fs-github)** - Github as storage adapter


## License

MIT

---

Part of the [@synet/fs](https://github.com/synthetism/fs) ecosystem.
