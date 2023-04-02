// Chakra imports
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Flex,
  Image,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import React from "react";
import {useConnectWallet} from "@web3-onboard/react";
import {ethers} from "ethers";
import Client from '@pioneer-platform/pioneer-client'

const ProjectCard = ({ image, name, app, category, avatars, description }) => {
  // Chakra color mode
  const textColor = useColorModeValue("gray.700", "white");

  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()

  //
  let whitelistDapp = async function (name,app) {
    try {
      //let spec = "https://pioneers.dev/spec/swagger.json"
      let spec = "http://127.0.0.1:9001/spec/swagger.json"
      let config = { queryKey: 'key:public', spec }
      let Api = new Client(spec, config)
      let api = await Api.init()

      //Sign
      let payload = {
        name,
        app
      }
      payload = JSON.stringify(payload)

      let address = wallet?.accounts[0]?.address
      console.log("address: ",address)

      // const ethersWallet = new ethers.Wallet(wallet.provider)
      const ethersProvider = new ethers.providers.Web3Provider(wallet.provider, 'any')
      const signer = ethersProvider.getSigner()
      let signature = await signer.signMessage(payload,address)
      let entry = {}
      //submit
      entry.signer = address
      entry.payload = payload
      entry.signature = signature

      let resultWhitelist = await api.WhitelistApp("",entry)
      console.log("resultWhitelist: ",resultWhitelist)
    } catch (e) {
      console.error(e)
    }
  }


  return (
    <Flex direction='column'>
      <Box mb='20px' position='relative' borderRadius='15px'>
        <Image src={image} borderRadius='15px' />
        <Box
          w='100%'
          h='100%'
          position='absolute'
          top='0'
          borderRadius='15px'
          bg='linear-gradient(360deg, rgba(49, 56, 96, 0.16) 0%, rgba(21, 25, 40, 0.88) 100%)'></Box>
      </Box>
      <Flex direction='column'>
        <Text fontSize='md' color='gray.500' fontWeight='600' mb='10px'>
          {name}
        </Text>
        <Text fontSize='xl' color={textColor} fontWeight='bold' mb='10px'>
          {category}
        </Text>
        <Text fontSize='md' color='gray.500' fontWeight='400' mb='20px'>
          {description}
        </Text>
        <Flex justifyContent='space-between'>
          <Button
            onClick={() => whitelistDapp(name,app)}
            variant='outline'
            colorScheme='teal'
            minW='110px'
            h='36px'
            fontSize='xs'
            px='1.5rem'>
            Approve
          </Button>
          <AvatarGroup size='xs'>
            {avatars.map((el, idx) => {
              return <Avatar src={el} key={idx} />;
            })}
          </AvatarGroup>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default ProjectCard;
