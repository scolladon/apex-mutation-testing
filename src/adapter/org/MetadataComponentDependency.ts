export interface MetadataComponentDependency {
  Id: string
  RefMetadataComponentType: string
  RefMetadataComponentName: string
  RefMetadataComponentNamespace: string | null
  [key: string]: string | number | boolean | null | undefined
}
