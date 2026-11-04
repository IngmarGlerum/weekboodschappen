import { Box, Heading, Stack, Text } from '@chakra-ui/react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <Box minH="100dvh" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center" px="4" py="8">
      <Stack gap="6" w="full" maxW="420px" bg="bg" p="6" rounded="lg" borderWidth="1px">
        <Box>
          <Heading size="2xl">Weekplanner</Heading>
          <Text color="fg.muted">Avondeten en boodschappen, samen gepland.</Text>
        </Box>
        <LoginForm intro="Log in met je e-mailadres en wachtwoord." />
      </Stack>
    </Box>
  )
}
