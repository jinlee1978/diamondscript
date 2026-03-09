/**
 * BUILD 100: Team Profile Storage Tests
 *
 * Tests CRUD operations, active team switching, color assignment,
 * and onboarding detection for team profiles.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup } from '../../src/data/types';
import {
  loadTeamProfiles,
  createTeamProfile,
  updateTeamProfile,
  deleteTeamProfile,
  setActiveTeam,
  getActiveTeamProfile,
  needsOnboarding,
} from '../../src/data/storage/teamProfileStorage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock coachingStorage
jest.mock('../../src/data/storage/coachingStorage', () => ({
  createDefaultCoachingStaff: () => ({
    coaches: [
      { id: 'head', name: 'Head Coach', role: 'head', specialties: [], isActive: true },
    ],
  }),
}));

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue();
});

describe('Team Profile Storage', () => {
  describe('loadTeamProfiles', () => {
    it('returns empty store when nothing persisted', async () => {
      const store = await loadTeamProfiles();
      expect(store.profiles).toEqual([]);
      expect(store.activeTeamId).toBeNull();
    });

    it('loads persisted profiles', async () => {
      const saved = {
        profiles: [
          { id: 'team-1', name: 'Red Sox', ageGroup: AgeGroup.KID_PITCH, color: '#1B4332' },
        ],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(saved));
      const store = await loadTeamProfiles();
      expect(store.profiles).toHaveLength(1);
      expect(store.profiles[0].name).toBe('Red Sox');
      expect(store.activeTeamId).toBe('team-1');
    });
  });

  describe('createTeamProfile', () => {
    it('creates a team with auto-activation for first team', async () => {
      const { store, newProfile } = await createTeamProfile('My Team', AgeGroup.COACH_PITCH);
      expect(newProfile.name).toBe('My Team');
      expect(newProfile.ageGroup).toBe(AgeGroup.COACH_PITCH);
      expect(newProfile.experienceLevel).toBe(2); // default
      expect(newProfile.color).toBe('#1B4332'); // first color
      expect(store.activeTeamId).toBe(newProfile.id);
      expect(store.profiles).toHaveLength(1);
      expect(mockSetItem).toHaveBeenCalled();
    });

    it('picks next available color', async () => {
      // First team already exists with green
      const existing = {
        profiles: [{ id: 'team-1', name: 'Team A', color: '#1B4332' }],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const { newProfile } = await createTeamProfile('Team B', AgeGroup.T_BALL);
      expect(newProfile.color).toBe('#1E40AF'); // second color (Blue)
    });

    it('does not change active team for subsequent teams', async () => {
      const existing = {
        profiles: [{ id: 'team-1', name: 'Team A', color: '#1B4332' }],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const { store } = await createTeamProfile('Team B', AgeGroup.T_BALL);
      expect(store.activeTeamId).toBe('team-1'); // still first team
    });
  });

  describe('updateTeamProfile', () => {
    it('updates specified fields', async () => {
      const existing = {
        profiles: [
          { id: 'team-1', name: 'Old Name', ageGroup: AgeGroup.T_BALL, color: '#1B4332', experienceLevel: 2 },
        ],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const store = await updateTeamProfile('team-1', { name: 'New Name', experienceLevel: 4 });
      expect(store.profiles[0].name).toBe('New Name');
      expect(store.profiles[0].experienceLevel).toBe(4);
      expect(store.profiles[0].ageGroup).toBe(AgeGroup.T_BALL); // unchanged
    });
  });

  describe('deleteTeamProfile', () => {
    it('removes team and switches active if needed', async () => {
      const existing = {
        profiles: [
          { id: 'team-1', name: 'Team A', color: '#1B4332' },
          { id: 'team-2', name: 'Team B', color: '#1E40AF' },
        ],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const store = await deleteTeamProfile('team-1');
      expect(store.profiles).toHaveLength(1);
      expect(store.activeTeamId).toBe('team-2'); // auto-switch
    });

    it('sets active to null when last team deleted', async () => {
      const existing = {
        profiles: [{ id: 'team-1', name: 'Solo', color: '#1B4332' }],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const store = await deleteTeamProfile('team-1');
      expect(store.profiles).toHaveLength(0);
      expect(store.activeTeamId).toBeNull();
    });
  });

  describe('setActiveTeam', () => {
    it('switches active team', async () => {
      const existing = {
        profiles: [
          { id: 'team-1', name: 'A' },
          { id: 'team-2', name: 'B' },
        ],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const store = await setActiveTeam('team-2');
      expect(store.activeTeamId).toBe('team-2');
    });

    it('ignores invalid team ID', async () => {
      const existing = {
        profiles: [{ id: 'team-1', name: 'A' }],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const store = await setActiveTeam('nonexistent');
      expect(store.activeTeamId).toBe('team-1'); // unchanged
    });
  });

  describe('getActiveTeamProfile', () => {
    it('returns active team profile', async () => {
      const existing = {
        profiles: [
          { id: 'team-1', name: 'Active Team', ageGroup: AgeGroup.COMPETITIVE },
        ],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      const team = await getActiveTeamProfile();
      expect(team?.name).toBe('Active Team');
      expect(team?.ageGroup).toBe(AgeGroup.COMPETITIVE);
    });

    it('returns null when no active team', async () => {
      const team = await getActiveTeamProfile();
      expect(team).toBeNull();
    });
  });

  describe('needsOnboarding', () => {
    it('returns true when no teams exist', async () => {
      expect(await needsOnboarding()).toBe(true);
    });

    it('returns false when teams exist', async () => {
      const existing = {
        profiles: [{ id: 'team-1', name: 'A' }],
        activeTeamId: 'team-1',
        lastModified: 1000,
      };
      mockGetItem.mockResolvedValue(JSON.stringify(existing));
      expect(await needsOnboarding()).toBe(false);
    });
  });
});
