import { Request, Response } from 'express';

import { toProjectResponse } from '../models/project.model';
import { ProjectService } from '../services/project.service';
import { currentUserId, pathParam } from '../utils/request';
import { parseBody } from '../validation/parse';
import { createProjectSchema, updateProjectSchema } from '../validation/project.validation';

/** `/projects` — CRUD for the codebases Bug Hunter may read. */
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const projects = await this.projects.list(currentUserId(request));

    response.json({ projects: projects.map(toProjectResponse), total: projects.length });
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const project = await this.projects.get(currentUserId(request), pathParam(request, 'id'));

    response.json({ project: toProjectResponse(project) });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(createProjectSchema, request.body);
    const project = await this.projects.create(currentUserId(request), input);

    response.status(201).json({ project: toProjectResponse(project) });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(updateProjectSchema, request.body);
    const project = await this.projects.update(
      currentUserId(request),
      pathParam(request, 'id'),
      input
    );

    response.json({ project: toProjectResponse(project) });
  };

  remove = async (request: Request, response: Response): Promise<void> => {
    const id = pathParam(request, 'id');

    await this.projects.remove(currentUserId(request), id);

    response.json({ success: true, id });
  };
}
