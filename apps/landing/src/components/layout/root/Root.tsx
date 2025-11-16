import { Content } from '../content/Content'

export const Root: Component = ({ children }) => {
  return (
    <>
      <Content>{children}</Content>
    </>
  )
}
