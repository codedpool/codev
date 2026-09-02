import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, unique: true },
    projectName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // owner
    files: [{ fileName: String, content: String }],
    // Local version history (isomorphic-git). No remotes — see src/backend/git.js.
    git: {
      branch: { type: String, default: 'main' },
      // Loose object SHAs referenced by refs/heads/<branch> — lets us prune unreachable
      // GitObject rows on delete without walking the whole history.
      headOid: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Project || mongoose.model('Project', projectSchema);
