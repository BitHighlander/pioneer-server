// Chakra imports
import {
  Table,
  Tbody,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";
// Custom components
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";
import CardHeader from "components/Card/CardHeader.js";
import TablesTableRow from "components/Tables/TablesTableRow";
import React from "react";



const Authors = ({ title, captions, data }) => {
  const textColor = useColorModeValue("gray.700", "white");

  // const onLogin = async function(){
  //   try{
  //     let address = wallet?.accounts[0]?.address
  //     console.log("address: ",address)
  //
  //     let config = {
  //       queryKey:'key:public',
  //       username:"billybob",
  //       spec
  //     }
  //
  //     //get config
  //     let client = new Client(spec,config)
  //     let pioneer = await client.init()
  //
  //     //is address logged in?
  //     let user = await pioneer.instance.GetUser({publicAddress:address})
  //     console.log("user: ",user.data)
  //
  //
  //     return true
  //   }catch(e){
  //     console.error(e)
  //   }
  // }

  // useEffect(() => {
  //
  // }, [])

  return (
    <Card overflowX={{ sm: "scroll", xl: "hidden" }}>
      <CardHeader p='6px 0px 22px 0px'>
        <Text fontSize='xl' color={textColor} fontWeight='bold'>
          {title}
        </Text>
      </CardHeader>
      <CardBody>
        <Table variant='simple' color={textColor}>
          <Thead>
            <Tr my='.8rem' pl='0px' color='gray.400'>
              {captions.map((caption, idx) => {
                return (
                  <Th color='gray.400' key={idx} ps={idx === 0 ? "0px" : null}>
                    {caption}
                  </Th>
                );
              })}
            </Tr>
          </Thead>
          <Tbody>
            {data.map((row) => {
              return (
                <TablesTableRow
                  key={`${row.email}-${row.name}`}
                  name={row.name}
                  logo={row.logo}
                  email={row.email}
                  subdomain={row.subdomain}
                  domain={row.domain}
                  status={row.status}
                  date={row.date}
                />
              );
            })}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
};

export default Authors;
