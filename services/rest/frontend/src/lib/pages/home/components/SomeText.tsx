import { Grid, Heading, Text } from "@chakra-ui/react";

const SomeText = () => {
  return (
    <Grid textAlign="center" gap={2}>
      <Heading fontSize="2xl" fontWeight="extrabold">
        Pioneer Template
      </Heading>
      <Text color="gray.500" fontSize="sm">
        The Most Powerful Template for Building on Crypto
      </Text>
    </Grid>
  );
};

export default SomeText;
