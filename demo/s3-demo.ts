/**
 * S3 Filesystem Demo - Cloud storage with Filesystem Unit
 * 
 * This demo shows how to use S3 as a backend for identity and data storage.
 * You'll need valid AWS credentials to run the full demo.
 */


import { fileURLToPath } from 'url';
import type { S3FileSystemOptions } from '../src/s3';
import { 
  S3FileSystem as AsyncS3FileSystem,
  createS3FileSystem } from '../src/s3';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

  const testConfigPath = path.join(__dirname, '../private/s3.json');
    const testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
   
/**
 * Demo configuration - Update with your actual AWS credentials
 */
const S3_CONFIG: S3FileSystemOptions = {
  region: testConfig.region, // Default region
  bucket: testConfig.bucket,
  prefix: 'synet-demo/',               // Optional: acts as root directory
  accessKeyId: testConfig.accessKeyId,   // Or use AWS profile/IAM role
  secretAccessKey: testConfig.secretAccessKey,   // Or use AWS profile/IAM role
};


/**
 * Demo: S3 filesystem for cloud storage
 */
export async function demonstrateS3Filesystem() {
  console.log('☁️  S3 Filesystem Unit Demo\n');

  try {
    // 1. Create S3 filesystem unit
    console.log('1. Creating S3 filesystem unit...');
    const fs = createS3FileSystem(S3_CONFIG); // Always use async for S3

    
    console.log('   Bucket:', S3_CONFIG.bucket);
    console.log('   Region:', S3_CONFIG.region);
    console.log('   Prefix:', S3_CONFIG.prefix || '(root)');
    console.log('');

    // 2. Basic operations
    console.log('2. Testing basic S3 operations...');
    
    // Write test data
    const testData = {
      message: 'Hello from S3 filesystem!',
      timestamp: new Date().toISOString(),
      backend: 's3',
      bucket: S3_CONFIG.bucket,
      region: S3_CONFIG.region
    };
    
    console.log('   Writing test file to S3...');
    await fs.writeFile('/test.json', JSON.stringify(testData, null, 2));
    console.log('   ✅ File written to S3');
    
    // Read back the data
    console.log('   Reading file from S3...');
    const content = await fs.readFile('/test.json');
    const parsed = JSON.parse(content);
    console.log('   ✅ File read back:', parsed.message);
    
    // Check if file exists
    const exists = await fs.exists('/test.json');
    console.log('   ✅ File exists:', exists);
    console.log('');

    // 3. Identity storage in cloud
    console.log('3. Cloud identity storage simulation...');
    
    // Create directory structure (S3 handles this virtually)
    await fs.ensureDir('/identities');
    await fs.ensureDir('/identities/users');
    await fs.ensureDir('/identities/organizations');
    
    const cloudIdentity = {
      alias: 's3-cloud-user',
      did: 'did:key:s3-cloud-123',
      publicKeyHex: '0x9876543210abcdef',
      privateKeyHex: '0xfedcba0987654321',
      provider: 's3-filesystem',
      createdAt: new Date().toISOString(),
      storage: {
        bucket: S3_CONFIG.bucket,
        region: S3_CONFIG.region,
        encrypted: false // Could be encrypted with @hsfs/encrypted
      }
    };
    
    console.log('   Saving identity to S3...');
    await fs.writeFile(
      '/identities/users/s3-cloud-user.json', 
      JSON.stringify(cloudIdentity, null, 2)
    );
    
    // Save public identity
    const { privateKeyHex, ...publicIdentity } = cloudIdentity;
    await fs.writeFile(
      '/identities/users/s3-cloud-user.public.json',
      JSON.stringify(publicIdentity, null, 2)
    );
    
    console.log('   ✅ Identity saved to S3');
    
    // Verify we can restore it
    console.log('   Restoring identity from S3...');
    const restoredContent = await fs.readFile('/identities/users/s3-cloud-user.json');
    const restoredIdentity = JSON.parse(restoredContent);
    console.log('   ✅ Identity restored:', restoredIdentity.alias);
    console.log('   ✅ Has private key:', !!restoredIdentity.privateKeyHex);
    console.log('   ✅ Stored in bucket:', restoredIdentity.storage.bucket);
    console.log('');

    // 4. Multi-user scenario
    console.log('4. Multi-user cloud scenario...');
    
    const users = ['alice', 'bob', 'charlie'];
    
    for (const user of users) {
      const userIdentity = {
        alias: user,
        did: `did:key:${user}-${Date.now()}`,
        publicKeyHex: `0x${user}${'0'.repeat(20)}`,
        createdAt: new Date().toISOString(),
        cloudBackup: true
      };
      
      await fs.writeFile(
        `/identities/users/${user}.json`,
        JSON.stringify(userIdentity, null, 2)
      );
    }
    
    console.log(`   ✅ Created ${users.length} user identities in S3`);
    
    // List all users (simulated - S3 doesn't have real directories)
    try {
      const userFiles = await fs.readDir('/identities/users');
      console.log('   ✅ User files:', userFiles.length);
    } catch (error) {
      console.log('   📝 Note: S3 directory listing may not work exactly like local filesystem');
    }
    console.log('');



    // 6. Configuration scenarios
    console.log('6. S3 configuration scenarios...');
    
    const configScenarios = {
      'development': {
        encryption: false,
        versioning: false,
        lifecycle: 'none'
      },
      'staging': {
        encryption: true,
        versioning: true,
        lifecycle: '30-days'
      },
      'production': {
        encryption: true,
        versioning: true,
        lifecycle: '7-years',
        backup: true,
        multiRegion: true
      }
    };

    await fs.ensureDir('/config/environments');
    
    for (const [env, config] of Object.entries(configScenarios)) {
      await fs.writeFile(
        `/config/environments/${env}.json`,
        JSON.stringify(config, null, 2)
      );
    }
    
    console.log('   ✅ Created environment configurations in S3');
    console.log('');

    // 7. Cleanup demo files
    console.log('7. Cleaning up demo files...');
    try {
      await fs.deleteFile('/test.json');
      await fs.deleteFile('/identities/users/s3-cloud-user.json');
      await fs.deleteFile('/identities/users/s3-cloud-user.public.json');
      
      for (const user of users) {
        await fs.deleteFile(`/identities/users/${user}.json`);
      }
      
      for (const env of Object.keys(configScenarios)) {
        await fs.deleteFile(`/config/environments/${env}.json`);
      }
      
      console.log('   ✅ Demo files cleaned up from S3');
    } catch (error) {
      console.log('   ⚠️  Some files may not exist:', (error as Error).message);
    }
    console.log('');

    console.log('✨ S3 Filesystem demo complete!');
    console.log('');
    console.log('Use cases for S3 filesystem:');
    console.log('   - Cloud-native applications');
    console.log('   - Distributed identity storage');
    console.log('   - Backup and disaster recovery');
    console.log('   - Multi-region deployment');
    console.log('   - Serverless applications');
    console.log('   - Enterprise data governance');

  } catch (error) {
    console.error('❌ S3 Demo failed:', (error as Error).message);
    console.log('');
    console.log('Common issues:');
    console.log('   - AWS credentials not configured');
    console.log('   - S3 bucket does not exist');
    console.log('   - Insufficient permissions');
    console.log('   - Network connectivity issues');
    console.log('');
    console.log('To fix:');
    console.log('   1. Update S3_CONFIG with your bucket name');
    console.log('   2. Configure AWS credentials:');
    console.log('      - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars');
    console.log('      - Or use AWS profile: aws configure');
    console.log('      - Or use IAM role if running on AWS');
    console.log('   3. Ensure bucket exists and has proper permissions');
  }
}

/**
 * Production S3 setup example
 */
export async function demonstrateProductionS3Setup() {
  console.log('🏢 Production S3 Setup Example\n');

  const productionConfigs = {
    'multi-region': {
      primary: {
        region: 'us-east-1',
        bucket: 'synet-identity-primary',
        prefix: 'production/'
      },
      backup: {
        region: 'eu-west-1', 
        bucket: 'synet-identity-backup',
        prefix: 'production/'
      }
    },
    'encrypted': {
      region: 'us-east-1',
      bucket: 'synet-identity-encrypted',
      prefix: 'secure/',
      encryption: 'AES256'
    },
    'compliance': {
      region: 'us-gov-east-1',
      bucket: 'synet-identity-compliance',
      prefix: 'regulated/',
      encryption: 'aws:kms',
      versioning: true,
      mfa: true
    }
  };

  console.log('Production S3 configurations:');
  console.log('');

  for (const [name, config] of Object.entries(productionConfigs)) {
    console.log(`${name.toUpperCase()} Configuration:`);
    console.log('   ', JSON.stringify(config, null, 4));
    console.log('');
  }

  console.log('Example usage:');
  console.log('');
  console.log('// Primary region storage');
  console.log('const primaryS3 = FileSystems.s3({');
  console.log('  region: "us-east-1",');
  console.log('  bucket: "synet-identity-primary",');
  console.log('  prefix: "production/"');
  console.log('});');
  console.log('');
  console.log('// Encrypted storage');
  console.log('const encryptedS3 = FileSystems.s3({');
  console.log('  region: "us-east-1",');
  console.log('  bucket: "synet-identity-encrypted",');
  console.log('  prefix: "secure/"');
  console.log('});');
  console.log('');
  console.log('// Usage in CLI');
  console.log('const fs = encryptedS3.teach();');
  console.log('await fs.writeFile("/identity.json", identityData);');
}

/**
 * S3 vs other backends comparison
 */
export function compareS3WithOtherBackends() {
  console.log('📊 S3 vs Other Backends Comparison\n');

  const comparison = {
    'Features': {
      'Node': 'Local, Fast, Simple',
      'Memory': 'Temporary, Ultra-fast, Testing',
      'GitHub': 'Version control, Collaboration, Public',
      'S3': 'Cloud, Scalable, Durable, Enterprise'
    },
    'Performance': {
      'Node': 'Fast (local disk)',
      'Memory': 'Ultra-fast (RAM)',
      'GitHub': 'Medium (API calls)',
      'S3': 'Medium (network latency)'
    },
    'Durability': {
      'Node': 'Single point of failure',
      'Memory': 'Lost on restart',
      'GitHub': 'High (Git history)',
      'S3': 'Very high (11 9s)'
    },
    'Scalability': {
      'Node': 'Limited to local storage',
      'Memory': 'Limited to available RAM',
      'GitHub': 'Limited by Git repository size',
      'S3': 'Virtually unlimited'
    },
    'Cost': {
      'Node': 'Free (local resources)',
      'Memory': 'Free (local resources)', 
      'GitHub': 'Free/Paid (based on usage)',
      'S3': 'Pay per use (storage + requests)'
    },
    'Use Cases': {
      'Node': 'Development, CLI tools, Desktop apps',
      'Memory': 'Testing, Caching, Temporary data',
      'GitHub': 'Open source, Configuration, Collaboration',
      'S3': 'Production, Enterprise, Cloud-native'
    }
  };

  for (const [category, backends] of Object.entries(comparison)) {
    console.log(`${category}:`);
    for (const [backend, description] of Object.entries(backends)) {
      console.log(`   ${backend.padEnd(8)}: ${description}`);
    }
    console.log('');
  }

  console.log('✨ Choose the right backend for your use case!');
}

// Example usage:
// demonstrateS3Filesystem()
//   .then(() => demonstrateProductionS3Setup())
//   .then(() => compareS3WithOtherBackends())
//   .catch(console.error);

// Environment-aware configuration
interface AppConfig {
  storage: 'local' | 's3';
  aws?: {
    region: string;
    bucket: string;
    prefix?: string;
  };
}

// Document metadata interface
interface DocumentMetadata {
  originalName: string;
  uploadDate: string;
  userId: string;
  department?: string;
  category?: string;
  confidential?: boolean;
  [key: string]: unknown;
}

/**
 * Document Storage Service
 * 
 * Handles user document uploads with automatic organization,
 * metadata tracking, and efficient retrieval.
 */
class DocumentStorageService {

  private asyncFs: AsyncS3FileSystem;

  constructor(config: AppConfig['aws']) {
    if (!config) {
      throw new Error('AWS configuration required for S3 storage');
    }

  

    // Async filesystem for heavy operations
    this.asyncFs = new AsyncS3FileSystem({
      region: config.region,
      bucket: config.bucket,
      prefix: config.prefix || 'documents/',
    });

    console.log(`📁 Document storage initialized: s3://${config.bucket}/${config.prefix || ''}`);
  }

  /**
   * Upload user document with automatic organization
   */
  async uploadDocument(
    userId: string,
    filename: string,
    content: string | Buffer,
    metadata?: Partial<DocumentMetadata>
  ): Promise<{ path: string; url: string; size: number }> {
    // Organize files by user and date
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const documentPath = `users/${userId}/${date}/${sanitizedFilename}`;

    try {
      // Upload document
      await this.asyncFs.writeFile(documentPath, content.toString());
      
      // Store metadata separately
      if (metadata) {
        const metadataPath = `${documentPath}.meta`;
        await this.asyncFs.writeFile(metadataPath, JSON.stringify({
          originalName: filename,
          uploadDate: new Date().toISOString(),
          userId,
          ...metadata
        }, null, 2));
      }

      // Get file stats
      const stats = await this.asyncFs.stat(documentPath);
      
      console.log(`📄 Document uploaded: ${documentPath} (${stats.size} bytes)`);
      
      return {
        path: documentPath,
        url: `https://${this.asyncFs.getBucketInfo().bucket}.s3.${this.asyncFs.getBucketInfo().region}.amazonaws.com/${documentPath}`,
        size: stats.size
      };

    } catch (error) {
      console.error(`❌ Failed to upload document: ${error}`);
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve document with metadata
   */
  async getDocument(path: string): Promise<{ content: string; metadata?: DocumentMetadata }> {
    try {
      const content = await this.asyncFs.readFile(path);
      
      // Try to load metadata
      let metadata: DocumentMetadata | undefined;
      try {
        const metadataContent = await this.asyncFs.readFile(`${path}.meta`);
        metadata = JSON.parse(metadataContent) as DocumentMetadata;
      } catch {
        // Metadata file doesn't exist - that's okay
      }

      return { content, metadata };
    } catch (error) {
      throw new Error(`Failed to retrieve document ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List user documents with pagination
   */
  async listUserDocuments(userId: string, page = 1, pageSize = 20): Promise<{
    documents: Array<{ path: string; size: number; lastModified: Date; metadata?: DocumentMetadata }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      const userPath = `users/${userId}/`;
      const allFiles = await this.asyncFs.readDir(userPath);
      
      // Filter out metadata files and get document files only
      const documentFiles = allFiles
        .filter(file => !file.endsWith('.meta'))
        .sort()
        .reverse(); // Most recent first

      const total = documentFiles.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageFiles = documentFiles.slice(startIndex, endIndex);

      // Get stats and metadata for each file
      const documents = await Promise.all(
        pageFiles.map(async (file) => {
          const fullPath = `${userPath}${file}`;
          const stats = await this.asyncFs.stat(fullPath);
          
          // Try to load metadata
          let metadata: DocumentMetadata | undefined;
          try {
            const metadataContent = await this.asyncFs.readFile(`${fullPath}.meta`);
            metadata = JSON.parse(metadataContent) as DocumentMetadata;
          } catch {
            // No metadata
          }

          return {
            path: fullPath,
            size: stats.size,
            lastModified: stats.mtime,
            metadata
          };
        })
      );

      return {
        documents,
        total,
        hasMore: endIndex < total
      };

    } catch (error) {
      throw new Error(`Failed to list documents for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete document and its metadata
   */
  async deleteDocument(path: string): Promise<void> {
    try {
      await this.asyncFs.deleteFile(path);
      
      // Try to delete metadata file
      try {
        await this.asyncFs.deleteFile(`${path}.meta`);
      } catch {
        // Metadata file might not exist
      }

      console.log(`🗑️ Document deleted: ${path}`);
    } catch (error) {
      throw new Error(`Failed to delete document ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage statistics
   */
  getStorageInfo(): { bucket: string; region: string; prefix: string } {
    return this.asyncFs.getBucketInfo();
  }

  /**
   * Clear cache to free memory (useful for long-running services)
   */
  clearCache(): void {
    this.clearCache();
    this.asyncFs.clearCache();
    console.log('💾 Storage cache cleared');
  }
}

/**
 * Configuration Management Service
 * 
 * Manages application configuration files stored in S3 with
 * environment-specific organization and automatic fallbacks.
 */
class ConfigurationService {
  private fs: AsyncS3FileSystem;

  constructor(bucket: string, region: string, environment: string) {
    this.fs = new AsyncS3FileSystem({
      region,
      bucket,
      prefix: `config/${environment}/`
    });
  }

  /**
   * Load configuration with fallback to defaults
   */
  async loadConfig<T>(name: string, defaultValue: T): Promise<T> {
    const configPath = `${name}.json`;
    
    try {
      if (await this.fs.exists(configPath)) {
        const content = await this.fs.readFile(configPath);
        const config = JSON.parse(content);
        console.log(`⚙️ Loaded config: ${name}`);
        return { ...defaultValue, ...config };
      }
      
      // Save default config for future use
      await this.saveConfig(name, defaultValue);
      console.log(`⚙️ Created default config: ${name}`);
      return defaultValue;
    } catch (error) {
      console.warn(`⚠️ Failed to load config ${name}, using defaults: ${error}`);
      return defaultValue;
    }
  }

  /**
   * Save configuration
   */
  async saveConfig<T>(name: string, config: T): Promise<void> {
    const configPath = `${name}.json`;
    
    try {
      const content = JSON.stringify(config, null, 2);
      await this.fs.writeFile(configPath, content);
      console.log(`💾 Saved config: ${name}`);
    } catch (error) {
      throw new Error(`Failed to save config ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all configuration files
   */
  async listConfigs(): Promise<string[]> {
    try {
      const files = await this.fs.readDir('.');
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.warn(`⚠️ Failed to list configs: ${error}`);
      return [];
    }
  }
}

/**
 * Example Usage
      .catch(error => {
        console.warn(`⚠️ Failed to list configs: ${error}`);
        return [];
      });
    }
  }
}

/**
 * Example Usage
 */
async function exampleUsage() {
  const config: AppConfig = {
    storage: 's3',
    aws: {
      region: 'us-east-1',
      bucket: 'my-app-storage',
      prefix: 'production/'
    }
  };

  // Initialize services
  const documentService = new DocumentStorageService(config.aws);
  const configService = new ConfigurationService(
    config.aws?.bucket || 'default-bucket', 
    config.aws?.region || 'us-east-1', 
    'production'
  );

  try {
    // Configuration management
    const appConfig = await configService.loadConfig('app', {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['pdf', 'docx', 'txt'],
      retentionDays: 90
    });

    console.log('📋 App configuration:', appConfig);

    // Document operations
    const userId = 'user123';
    
    // Upload a document
    const uploadResult = await documentService.uploadDocument(
      userId,
      'report.pdf',
      'This is a sample PDF content...',
      {
        department: 'sales',
        category: 'report',
        confidential: true
      }
    );

    console.log('📤 Upload result:', uploadResult);

    // List user documents
    const userDocs = await documentService.listUserDocuments(userId);
    console.log(`📁 Found ${userDocs.total} documents for user ${userId}`);

    // Retrieve a document
    const document = await documentService.getDocument(uploadResult.path);
    console.log('📄 Retrieved document with metadata:', {
      contentLength: document.content.length,
      metadata: document.metadata
    });

    // Storage info
    const storageInfo = documentService.getStorageInfo();
    console.log('☁️ Storage info:', storageInfo);

  } catch (error) {
    console.error('❌ Example failed:', error);
  }

  // Cleanup
  documentService.clearCache();
}

/**
 * Environment-specific initialization
 */
function createFileSystemForEnvironment(): AsyncS3FileSystem | null {
  const environment = process.env.NODE_ENV || 'development';
  
  if (environment === 'production' || environment === 'staging') {
    // Use S3 in cloud environments
    return new AsyncS3FileSystem({
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || 'app-storage',
      prefix: `${environment}/`
    });
  }
  
  // Use local filesystem for development
  console.log('🏠 Using local filesystem for development');
  return null; // Would use NodeFileSystem instead
}

// Export services for use in other modules
export {
  DocumentStorageService,
  ConfigurationService,
  createFileSystemForEnvironment,
  exampleUsage
};

// Run example if this file is executed directly
/* if (require.main === module) {
  exampleUsage().catch(console.error);
} */

 demonstrateS3Filesystem()
   .then(() => demonstrateProductionS3Setup())
   .catch(console.error);
