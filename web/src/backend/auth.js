import { auth, currentUser } from '@clerk/nextjs/server';
import { connectDB } from './db';
import User from './models/User';
import Project from './models/Project';
import { HttpError } from './http';

/**
 * Resolve the signed-in Clerk user to our User document (creating it on first sign-in).
 * Legacy accounts (Auth0 era) are re-attached by e-mail so their projects carry over.
 */
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new HttpError(401, 'Sign in required');
  await connectDB();
  let user = await User.findOne({ clerkId: userId });
  if (user) return { user, clerkId: userId };

  const cu = await currentUser();
  const email = cu?.primaryEmailAddress?.emailAddress || cu?.emailAddresses?.[0]?.emailAddress;
  if (!email) throw new HttpError(400, 'Your account has no e-mail address');
  const name = cu.fullName || cu.username || email;
  user = await User.findOne({ email });
  if (user) {
    user.clerkId = userId;
    user.name = user.name || name;
    user.picture = cu.imageUrl || user.picture;
    await user.save();
  } else {
    user = await User.create({ clerkId: userId, email, name, picture: cu.imageUrl });
  }
  return { user, clerkId: userId };
}

/** Load a project or 404. `owner: true` additionally requires the caller to own it. */
export async function requireProject(projectId, user, { owner = false } = {}) {
  const project = await Project.findOne({ projectId });
  if (!project) throw new HttpError(404, 'Project not found');
  if (owner && String(project.userId) !== String(user._id)) throw new HttpError(403, 'Only the project owner can do that');
  return project;
}
