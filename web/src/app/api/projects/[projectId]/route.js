import { handler, json } from '@/backend/http';
import { requireUser, requireProject } from '@/backend/auth';
import Project from '@/backend/models/Project';
import User from '@/backend/models/User';
import GitObject from '@/backend/models/GitObject';
import { deleteProjectFiles } from '@/backend/s3';

// GET /api/projects/:projectId — any signed-in user with the link can open a project (share-by-link)
export const GET = handler(async (_req, { params }) => {
  const { user } = await requireUser();
  const { projectId } = await params;
  const p = await requireProject(projectId, user);
  return json({
    projectId: p.projectId,
    projectName: p.projectName,
    files: (p.files || []).map((f) => ({ fileName: f.fileName })),
    owner: String(p.userId) === String(user._id),
    git: { branch: p.git?.branch || 'main', headOid: p.git?.headOid || null },
  });
});

// DELETE /api/projects/:projectId — owner only
export const DELETE = handler(async (_req, { params }) => {
  const { user } = await requireUser();
  const { projectId } = await params;
  const p = await requireProject(projectId, user, { owner: true });
  await User.updateOne({ _id: p.userId }, { $pull: { projects: p._id } });
  await Project.deleteOne({ _id: p._id });
  await GitObject.deleteMany({ projectId });
  await deleteProjectFiles(projectId);
  return json({ message: 'Project deleted successfully!' });
});
