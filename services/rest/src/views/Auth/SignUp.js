// Chakra imports
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Link,
  Switch,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  useEffect
} from 'react';
import { PioneerService } from './Pioneer'
// Assets
import BgSignUp from "assets/img/community-web.jpg";
import React from "react";
import { FaApple, FaFacebook, FaGoogle } from "react-icons/fa";

const pioneer = new PioneerService()

function SignUp() {
  const titleColor = useColorModeValue("black.300", "black.200");
  const textColor = useColorModeValue("gray.700", "white");
  const bgColor = useColorModeValue("white", "gray.700");
  const bgIcons = useColorModeValue("green.200", "rgba(255, 255, 255, 0.5)");

  let onStart = async function (){
    try{
      console.log("On start of application")
      console.log("onStartPioneer")
      //
      let queryKey = localStorage.getItem('queryKey')
      let username = localStorage.getItem('username')
        if (!queryKey) {
            console.log("Creating new queryKey~!")
            queryKey = 'key:' + uuidv4()
            localStorage.setItem('queryKey', queryKey)
        }
        if (!username) {
            console.log("Creating new username~!")
            username = 'user:' + uuidv4()
            username = username.substring(0, 13);
            console.log("Creating new username~! username: ", username)
            localStorage.setItem('username', username)
        }
        //TODO dont get blockchains here (Get from API)
        let blockchains = [
          'bitcoin', 'ethereum', 'thorchain', 'bitcoincash', 'litecoin', 'binance', 'cosmos', 'dogecoin', 'osmosis'
        ]

        const config = {
          blockchains,
          username,
          queryKey,
          service: 'pioneers.dev',
          url: "pioneers.dev",
          wss: "",
          spec: "",
          paths: []
        }
        console.log("config: ", config)

        //Pioneer SDK
        let pioneer = new SDK(config.spec, config)
        console.log("config: ", config)
    }catch(e){
      console.error(e)
    }
  }
  useEffect(() => {
    onStart()
  }, [])


  return (
    <Flex
      direction='column'
      alignSelf='center'
      justifySelf='center'
      overflow='hidden'
    >
      <Box
        position='absolute'
        minH={{ base: "70vh", md: "50vh" }}
        w={{ md: "calc(100vw - 50px)" }}
        borderRadius={{ md: "15px" }}
        left='0'
        right='0'
        bgRepeat='no-repeat'
        overflow='hidden'
        zIndex='-1'
        top='0'
        bgImage={BgSignUp}
        bgSize='cover'
        mx={{ md: "auto" }}
        mt={{ md: "14px" }}></Box>
      <Flex
        direction='column'
        textAlign='center'
        justifyContent='center'
        align='center'
        mt='6.5rem'
        mb='30px'>
        <Text fontSize='4xl' color='white' fontWeight='bold'>
          Welcome!
        </Text>
        <Text
          fontSize='md'
          color='white'
          fontWeight='normal'
          mt='10px'
          mb='26px'
          w={{ base: "90%", sm: "60%", lg: "40%", xl: "30%" }}>
          Use these awesome forms to login or create new account in your project
          for free.
        </Text>
      </Flex>
      <Flex alignItems='center' justifyContent='center' mb='60px' mt='20px'>
        <Flex
          direction='column'
          w='445px'
          background='transparent'
          borderRadius='15px'
          p='40px'
          mx={{ base: "100px" }}
          bg={bgColor}
          boxShadow='0 20px 27px 0 rgb(0 0 0 / 5%)'>
          <Text
            fontSize='lg'
            color='gray.400'
            fontWeight='bold'
            textAlign='center'
            mb='22px'>
            Select a Username
          </Text>
          <FormControl>
            <FormLabel ms='4px' fontSize='sm' fontWeight='normal'>
              Username
            </FormLabel>
            <Input
              fontSize='sm'
              ms='4px'
              borderRadius='15px'
              type='text'
              placeholder='Username'
              mb='24px'
              size='lg'
            />
            <FormControl display='flex' alignItems='center' mb='24px'>
              <Switch id='remember-login' colorScheme='teal' me='10px' />
              <FormLabel htmlFor='remember-login' mb='0' fontWeight='normal'>
                Remember me
              </FormLabel>
            </FormControl>
            <Button
              type='submit'
              bg='green.300'
              fontSize='10px'
              color='white'
              fontWeight='bold'
              w='100%'
              h='45'
              mb='24px'
              _hover={{
                bg: "green.200",
              }}
              _active={{
                bg: "green.400",
              }}>
              SIGN UP
            </Button>
          </FormControl>
          <Flex
            flexDirection='column'
            justifyContent='center'
            alignItems='center'
            maxW='100%'
            mt='0px'>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}

export default SignUp;
