import { Box, Button, Flex, Image, Link } from "@chakra-ui/react";
import { AiFillGithub } from "react-icons/ai";

const CTASection = () => (
  <Box textAlign="center">
    <Link
      _hover={undefined}
      href="https://github.com/BitHighlander/pioneer-template"
    >
      <Button leftIcon={<AiFillGithub />} size="sm">
        Open in Github
      </Button>
    </Link>
    <Flex marginY={4} justifyContent="center" gridGap={2}>
      <Link
        aria-label="Deploy to Vercel"
        isExternal
        href="https://vercel.com/import/git?s=https://github.com/BitHighlander/pioneer-template"
      >
        <Image src="https://vercel.com/button" alt="Vercel deploy button" />
      </Link>
      <Link
        aria-label="Deploy to Netlify"
        isExternal
        href="https://app.netlify.com/start/deploy?repository=https://github.com/BitHighlander/pioneer-template"
      >
        <Image
          src="https://www.netlify.com/img/deploy/button.svg"
          alt="Netlify deploy button"
        />
      </Link>
    </Flex>
  </Box>
);

export default CTASection;
