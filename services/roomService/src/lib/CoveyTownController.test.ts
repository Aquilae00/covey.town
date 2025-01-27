import { nanoid } from 'nanoid';
import { mock, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import { UserLocation } from '../CoveyTypes';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';
import IDBClient from '../services/IDBClient';

jest.mock('./TwilioVideo');

const mockGetTokenForTown = jest.fn();
// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioVideo.getInstance = () => ({
  getTokenForTown: mockGetTokenForTown,
});

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

/**
 * Tests are successful when run individually
 */
describe('CoveyTownController', () => {
  beforeEach(() => {
    mockGetTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => { // Included in handout
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName)
      .toBe(townName);
  });

  describe('addPlayer', () => { // Included in handout
    it('should use the coveyTownID and player ID properties when requesting a video token',
      async () => {
        const townName = `FriendlyNameTest-${nanoid()}`;
        const townController = new CoveyTownController(townName, false);
        const newPlayerSession = await townController.addPlayer(new Player(nanoid(), nanoid()));
        expect(mockGetTokenForTown).toBeCalledTimes(1);
        expect(mockGetTokenForTown).toBeCalledWith(townController.coveyTownID, newPlayerSession.player.id);
      });

    it('should save the town to database', async () => {
      const mockDB = mock<Promise<IDBClient>>();
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      townController.setDBClient(mockDB);
      await townController.addPlayer(new Player(nanoid(), nanoid()));

      expect((await mockDB).saveTown).toBeCalled();
    });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [mock<CoveyTownListener>(), mock<CoveyTownListener>(), mock<CoveyTownListener>()];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player', nanoid());
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player', nanoid());
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      await testingTown.destroySession(session);
      mockListeners.forEach(listener => expect(listener.onPlayerDisconnected).toBeCalledWith(player));
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player(nanoid(), 'test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));

    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player(nanoid(), 'test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());

    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player(nanoid(), 'test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player(nanoid(), 'test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      await testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();

    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player(nanoid(), 'test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      await testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player(nanoid(), 'test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();

    });
  });
  describe('townSubscriptionHandler', () => {

    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      const mockSocket = mock<Socket>();
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
      mockReset(mockSocket);
      const player = new Player(nanoid(), 'test player');
      const session = await testingTown.addPlayer(player);
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      await townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      const mockSocket = mock<Socket>();
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      const townStore = await CoveyTownsStore.getInstance();
      const testingTown = await townStore.createTown(townName, false);
      mockReset(mockSocket);
      const player = new Player(nanoid(), 'test player');
      await testingTown.addPlayer(player);
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      await townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        const mockSocket = mock<Socket>();
        const townName = `connectPlayerSocket tests ${nanoid()}`;
        const townStore = await CoveyTownsStore.getInstance();
        const testingTown = await townStore.createTown(townName, false);
        mockReset(mockSocket);
        const player = new Player(nanoid(), 'test player');
        const session = await testingTown.addPlayer(player);
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        await townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        const mockSocket = mock<Socket>();
        const townName = `connectPlayerSocket tests ${nanoid()}`;
        const townStore = await CoveyTownsStore.getInstance();
        const testingTown = await townStore.createTown(townName, false);
        mockReset(mockSocket);
        const player = new Player(nanoid(), 'test player');
        const session = await testingTown.addPlayer(player);
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        await townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);

      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        const mockSocket = mock<Socket>();
        const townName = `connectPlayerSocket tests ${nanoid()}`;
        const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
        mockReset(mockSocket);
        const player = new Player(nanoid(), 'test player');
        const session = await testingTown.addPlayer(player);
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        await townSubscriptionHandler(mockSocket);
        await testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        const mockSocket = mock<Socket>();
        const townName = `connectPlayerSocket tests ${nanoid()}`;
        const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
        mockReset(mockSocket);
        const player = new Player(nanoid(), 'test player');
        const session = await testingTown.addPlayer(player);
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        await townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          const mockSocket = mock<Socket>();
          const townName = `connectPlayerSocket tests ${nanoid()}`;
          const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
          mockReset(mockSocket);
          const player = new Player(nanoid(), 'test player');
          const session = await testingTown.addPlayer(player);
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          await townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player(nanoid(), 'should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          const mockSocket = mock<Socket>();
          const townName = `connectPlayerSocket tests ${nanoid()}`;
          const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
          mockReset(mockSocket);
          const player = new Player(nanoid(), 'test player');
          const session = await testingTown.addPlayer(player);
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          await townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
            await townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }

        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        const mockSocket = mock<Socket>();
        const townName = `connectPlayerSocket tests ${nanoid()}`;
        const testingTown = await (await CoveyTownsStore.getInstance()).createTown(townName, false);
        mockReset(mockSocket);
        const player = new Player(nanoid(), 'test player');
        const session = await testingTown.addPlayer(player);
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        await townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(call => call[0] === 'playerMovement');
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });

  describe('destroySession', () => {
    it('saves the updated town state to database', async () => {
      const mockDB = mock<Promise<IDBClient>>();
      const testTown = new CoveyTownController('', true);
      testTown.setDBClient(mockDB);
      const player = new Player('test player', nanoid());
      const session = await testTown.addPlayer(player);
      await testTown.destroySession(session);

      expect((await mockDB).saveTown).toBeCalled();
    });
  });
});
