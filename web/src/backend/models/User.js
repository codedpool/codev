import mongoose from 'mongoose';

// Users are keyed by their Clerk id. `auth0Id` is kept (optional) so accounts created before the
// Clerk migration can be re-attached by e-mail on first sign-in.
const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, index: true, sparse: true, unique: true },
    auth0Id: { type: String, sparse: true },
    email: { type: String, required: true, unique: true },
    name: String,
    picture: String,
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
