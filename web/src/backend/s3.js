import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET_NAME;
let client;
function s3() {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
        : undefined,
    });
  }
  return client;
}
const key = (projectId, fileName) => `${projectId}/${fileName}`;

export async function getFile(projectId, fileName) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key(projectId, fileName) }));
  return res.Body.transformToString('utf-8');
}
export async function putFile(projectId, fileName, content) {
  await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key(projectId, fileName), Body: content ?? '', ContentType: 'text/plain; charset=utf-8' }));
}
export async function deleteFile(projectId, fileName) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key(projectId, fileName) }));
}
export async function copyFile(projectId, from, to) {
  await s3().send(new CopyObjectCommand({ Bucket: bucket, CopySource: `/${bucket}/${encodeURIComponent(key(projectId, from))}`, Key: key(projectId, to) }));
}
export async function deleteProjectFiles(projectId) {
  const listed = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${projectId}/` }));
  if (listed.Contents?.length) {
    await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: listed.Contents.map(({ Key }) => ({ Key })) } }));
  }
}
export function isNotFound(err) {
  return err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
}
