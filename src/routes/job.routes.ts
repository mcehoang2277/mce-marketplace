import { Router, Request, Response } from 'express';
import { repository } from '../repositories/in-memory.repository';
import { MatchingService } from '../modules/matching/matching.service';

export const jobRouter = Router();

jobRouter.get('/candidates', async (req: Request, res: Response) => {
  const candidates = await repository.findAll();
  res.json({
    success: true,
    total: candidates.length,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.fullName,
      phone: c.phone,
      location: c.location,
      skills: c.skills,
      karmaScore: c.karmaScore,
      desiredRateVnd: c.desiredMinHourlyRateVnd
    }))
  });
});

jobRouter.get('/jobs/match', async (req: Request, res: Response) => {
  const candidates = await repository.findAll();
  const sampleJob = repository.getSampleJob();
  const matches = MatchingService.rankCandidates(candidates, sampleJob);

  res.json({
    success: true,
    jobId: sampleJob.id,
    jobTitle: sampleJob.title,
    matches
  });
});

jobRouter.get('/jobs/benchmark', (req: Request, res: Response) => {
  const rate = parseInt(req.query.rate as string, 10) || 80000;
  const benchmark = MatchingService.calculatePriceBenchmark(rate);
  res.json({ success: true, benchmark });
});
