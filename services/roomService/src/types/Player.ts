import { nanoid } from 'nanoid';
import { UserLocation } from '../CoveyTypes';

/**
 * Each user who is connected to a town is represented by a Player object
 */
export default class Player {
  /** The current location of this user in the world map * */
  public location: UserLocation;

  /** The unique identifier for this player * */
  private readonly _id: string;

  /** The player's username, which is not guaranteed to be unique within the town * */
  private readonly _userName: string;

  private readonly _coveyUserID: string;

  constructor(userName: string, coveyUserID: string) {
    this.location = {
      x: 0,
      y: 0,
      moving: false,
      rotation: 'front',
    };
    this._userName = userName;
    this._id = nanoid();
    this._coveyUserID = coveyUserID;
  }

  get userName(): string {
    return this._userName;
  }

  get id(): string {
    return this._id;
  }

  updateLocation(location: UserLocation): void {
    this.location = location;
  }
}
