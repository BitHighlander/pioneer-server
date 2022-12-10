// Chakra imports
import {
  Flex,
  Grid,
  Image,
  SimpleGrid,
  useColorModeValue,
} from "@chakra-ui/react";
// assets
import peopleImage from "assets/img/people-image.png";
import logoChakra from "assets/svg/logo-white.svg";
import BarChart from "components/Charts/BarChart";
import LineChart from "components/Charts/LineChart";
// Custom icons
import {
  CartIcon,
  DocumentIcon,
  GlobeIcon,
  WalletIcon,
} from "components/Icons/Icons.js";
import React from "react";
import { useEffect, useState } from 'react'
import { dashboardTableData, timelineData } from "variables/general";
import ActiveUsers from "./components/ActiveUsers";
import BuiltByDevelopers from "./components/BuiltByDevelopers";
import MiniStatistics from "./components/MiniStatistics";
import OrdersOverview from "./components/OrdersOverview";
import Projects from "./components/Projects";
import SalesOverview from "./components/SalesOverview";
import WorkWithTheRockets from "./components/WorkWithTheRockets";
import Client from '@pioneer-platform/pioneer-client'

export default function Dashboard() {
  const iconBoxInside = useColorModeValue("white", "white");
    const [users, setUsers] = useState(0)
    const [assets, setAssets] = useState(0)
    const [networks, setNetworks] = useState(0)
    const [dapps, setDapps] = useState(0)
    const [downloads, setDownloads] = useState(0)

    //get MOTD
    let updateGlobals = async function () {
        try {
            //let spec = "https://pioneers.dev/spec/swagger.json"
            let spec = "http://127.0.0.1:9001/spec/swagger.json"
            let config = { queryKey: 'key:public', spec }
            let Api = new Client(spec, config)
            let api = await Api.init()
            let info = await api.Globals()
            console.log('info: ', info.data)
            setUsers(info.data.info.users)
            setAssets(info.data.info.assets)
            setNetworks(info.data.info.networks)
            setDapps(info.data.info.dapps)
            setDownloads(info.data.downloads.total)

        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        updateGlobals()
    }, [])

  return (
    <Flex flexDirection='column' pt={{ base: "120px", md: "75px" }}>
      <SimpleGrid columns={{ sm: 1, md: 3, xl: 4 }} spacing='24px'>
        <MiniStatistics
          title={"Users"}
          amount={users}
          percentage={0}
          icon={<WalletIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
          <MiniStatistics
              title={"Downloads"}
              amount={downloads}
              percentage={0}
              icon={<WalletIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
          />
        <MiniStatistics
          title={"networks"}
          amount={networks}
          percentage={0}
          icon={<GlobeIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
        <MiniStatistics
          title={"dapps"}
          amount={dapps}
          percentage={-14}
          icon={<DocumentIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
      </SimpleGrid>
      <Grid
        templateColumns={{ md: "1fr", lg: "1.8fr 1.2fr" }}
        templateRows={{ md: "1fr auto", lg: "1fr" }}
        my='26px'
        gap='24px'>
        {/*<BuiltByDevelopers*/}
        {/*  title={"Built by Developers"}*/}
        {/*  name={"Developer Dashboard"}*/}
        {/*  description={*/}
        {/*    "From colors, cards, typography to complex elements, you will find the full documentation."*/}
        {/*  }*/}
        {/*  image={*/}
        {/*    <Image*/}
        {/*      src={logoChakra}*/}
        {/*      alt='chakra image'*/}
        {/*      minWidth={{ md: "300px", lg: "auto" }}*/}
        {/*    />*/}
        {/*  }*/}
        {/*/>*/}
        {/*<WorkWithTheRockets*/}
        {/*  backgroundImage={peopleImage}*/}
        {/*  title={"Work with the rockets"}*/}
        {/*  description={*/}
        {/*    "Wealth creation is a revolutionary recent positive-sum game. It is all about who takes the opportunity first."*/}
        {/*  }*/}
        {/*/>*/}
      </Grid>
      {/*<Grid*/}
      {/*  templateColumns={{ sm: "1fr", lg: "1.3fr 1.7fr" }}*/}
      {/*  templateRows={{ sm: "repeat(2, 1fr)", lg: "1fr" }}*/}
      {/*  gap='24px'*/}
      {/*  mb={{ lg: "26px" }}>*/}
      {/*  <ActiveUsers*/}
      {/*    title={"Active Users"}*/}
      {/*    percentage={23}*/}
      {/*    chart={<BarChart />}*/}
      {/*  />*/}
      {/*  <SalesOverview*/}
      {/*    title={"Daily Active users"}*/}
      {/*    percentage={5}*/}
      {/*    chart={<LineChart />}*/}
      {/*  />*/}
      {/*</Grid>*/}
      {/*<Grid*/}
      {/*  templateColumns={{ sm: "1fr", md: "1fr 1fr", lg: "3fr 1fr" }}*/}
      {/*  templateRows={{ sm: "1fr auto", md: "1fr", lg: "1fr" }}*/}
      {/*  gap='24px'>*/}
      {/*  <Projects*/}
      {/*    title={"Projects"}*/}
      {/*    amount={30}*/}
      {/*    captions={["Companies", "Members", "Budget", "Completion"]}*/}
      {/*    data={dashboardTableData}*/}
      {/*  />*/}
      {/*  <OrdersOverview*/}
      {/*    title={"Orders Overview"}*/}
      {/*    amount={30}*/}
      {/*    data={timelineData}*/}
      {/*  />*/}
      {/*</Grid>*/}
    </Flex>
  );
}
