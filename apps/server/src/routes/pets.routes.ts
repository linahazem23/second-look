import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { growthStageForFedPoints } from '../lib/pets.js';

export const petsRouter = Router();

// Must match apps/web/src/petPresets.tsx's PET_SPECIES keys — each has real
// artwork at /pets/<species>-<baby|adult|deluxe>.jpg.
const SPECIES = ['puppy', 'kitten', 'otter', 'duckling', 'hamster', 'turtle', 'dolphin', 'frog'] as const;
const MAX_PETS_PER_USER = 2;

petsRouter.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  const [pets, inventory, catalog] = await Promise.all([
    prisma.pet.findMany({ where: { userId: req.userId }, orderBy: { adoptedAt: 'asc' } }),
    prisma.petInventory.findMany({ where: { userId: req.userId, quantity: { gt: 0 } } }),
    prisma.petItemCatalog.findMany({ orderBy: { pointsCost: 'asc' } })
  ]);
  return res.json({ pets, inventory, catalog });
});

const adoptSchema = z.object({ species: z.enum(SPECIES), name: z.string().min(1).max(30) });

petsRouter.post('/adopt', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = adoptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const count = await prisma.pet.count({ where: { userId: req.userId } });
  if (count >= MAX_PETS_PER_USER) {
    return res.status(409).json({ error: `You can have at most ${MAX_PETS_PER_USER} pets.` });
  }

  const pet = await prisma.pet.create({
    data: { userId: req.userId!, species: parsed.data.species, name: parsed.data.name }
  });
  return res.status(201).json({ pet });
});

const buySchema = z.object({ itemKey: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) });

petsRouter.post('/shop/buy', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const item = await prisma.petItemCatalog.findUnique({ where: { key: parsed.data.itemKey } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const totalCost = item.pointsCost * parsed.data.quantity;
  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
  if (me.points < totalCost) return res.status(422).json({ error: "You don't have enough points for that." });

  await prisma.$transaction([
    prisma.user.update({ where: { id: req.userId }, data: { points: { decrement: totalCost } } }),
    prisma.petInventory.upsert({
      where: { userId_itemKey: { userId: req.userId!, itemKey: item.key } },
      update: { quantity: { increment: parsed.data.quantity } },
      create: { userId: req.userId!, itemKey: item.key, quantity: parsed.data.quantity }
    })
  ]);

  return res.status(201).json({ ok: true });
});

const useItemSchema = z.object({ itemKey: z.string().min(1) });

petsRouter.post('/:petId/use-item', requireAuth, async (req: AuthedRequest, res) => {
  const pet = await prisma.pet.findUnique({ where: { id: req.params.petId } });
  if (!pet || pet.userId !== req.userId) return res.status(404).json({ error: 'Pet not found' });

  const parsed = useItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const [item, inventory] = await Promise.all([
    prisma.petItemCatalog.findUnique({ where: { key: parsed.data.itemKey } }),
    prisma.petInventory.findUnique({ where: { userId_itemKey: { userId: req.userId!, itemKey: parsed.data.itemKey } } })
  ]);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (!inventory || inventory.quantity < 1) return res.status(422).json({ error: "You don't have any of that item." });

  const fedPoints = pet.fedPoints + item.effect;
  const growthStage = growthStageForFedPoints(fedPoints);
  const happiness = Math.min(100, pet.happiness + item.effect);

  const [, updatedPet] = await prisma.$transaction([
    prisma.petInventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } }),
    prisma.pet.update({ where: { id: pet.id }, data: { fedPoints, growthStage, happiness, lastFedAt: new Date() } })
  ]);

  return res.json({ pet: updatedPet });
});
