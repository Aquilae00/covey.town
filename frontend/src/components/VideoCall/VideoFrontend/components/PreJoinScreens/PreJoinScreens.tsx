import React from 'react';
import { Heading, Text, Button, Link, useToast } from '@chakra-ui/react';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import IntroContainer from '../IntroContainer/IntroContainer';
import { TownJoinResponse } from '../../../../../classes/TownsServiceClient';
import TownSelection from '../../../../Login/TownSelection';
import IAuth from '../../../../../services/authentication/IAuth';
import RealmAuth from '../../../../../services/authentication/RealmAuth';

export default function PreJoinScreens(props: { doLogin: (initData: TownJoinResponse) => Promise<boolean>; setMediaError?(error: Error): void }) {
  const toast = useToast();
  const auth: IAuth = RealmAuth.getInstance();
  const loggedInUser = auth.getCurrentUser();
  console.log(loggedInUser)
  if (loggedInUser === null) {
    toast({
      title: "Unable to find user profile",
      description: "Unable to find user profile",
      status: "error"
    })
  }
  const userName = loggedInUser?.profile.userName;

  return (
    <IntroContainer>
      <Heading as="h2" size="xl">Welcome to Covey.Town, {userName}!</Heading>
      <Text p="4">
        Covey.Town is a social platform that integrates a 2D game-like metaphor with video chat.
        To get started, setup your camera and microphone, choose a username, and then create a new town
        to hang out in, or join an existing one.
      </Text>
      <DeviceSelectionScreen setMediaError={props.setMediaError} />
      <TownSelection doLogin={props.doLogin} />
    </IntroContainer>
  );
}
