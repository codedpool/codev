import mongoose from 'mongoose';

// One document per loose git object (blob/tree/commit), content-addressed by its SHA-1.
// Storing the raw compressed bytes isomorphic-git writes to .git/objects/xx/yyyy... lets us
// rehydrate a repo into an in-memory filesystem on demand without any persistent disk.
const gitObjectSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    oid: { type: String, required: true }, // 40-char SHA-1
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);
gitObjectSchema.index({ projectId: 1, oid: 1 }, { unique: true });

export default mongoose.models.GitObject || mongoose.model('GitObject', gitObjectSchema);
