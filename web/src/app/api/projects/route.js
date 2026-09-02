import { v4 as uuidv4 } from 'uuid';
import { handler, json, readJson, HttpError } from '@/backend/http';
import { requireUser } from '@/backend/auth';
import Project from '@/backend/models/Project';

// GET /api/projects — projects owned by the signed-in user
export const GET = handler(async () => {
  const { user } = await requireUser();
  const projects = await Project.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
  return json(projects.map((p) => ({ projectId: p.projectId, projectName: p.projectName, files: (p.files || []).map((f) => ({ fileName: f.fileName })), updatedAt: p.updatedAt })));
});

// POST /api/projects { projectName }
export const POST = handler(async (req) => {
  const { user } = await requireUser();
  const { projectName } = await readJson(req);
  const name = String(projectName || '').trim();
  if (!name) throw new HttpError(400, 'Project name is required');
  if (name.length > 80) throw new HttpError(400, 'Project name is too long');
  const projectId = uuidv4();
  const project = await Project.create({ projectId, projectName: name, userId: user._id, files: [] });
  user.projects.push(project._id);
  await user.save();
  return json({ projectId, projectName: name, files: [] }, { status: 201 });
});
