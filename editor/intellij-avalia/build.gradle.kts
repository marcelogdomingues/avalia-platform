// Plugin IntelliJ da Avalia — esqueleto Gradle.
// Requer a IntelliJ Platform Gradle Plugin. Constrói com: ./gradlew buildPlugin
// (NÃO foi compilado no ambiente da plataforma — precisa do SDK IntelliJ.)
plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij") version "1.17.4"
}

group = "net.avalia"
version = "0.1.0"

repositories { mavenCentral() }

// Alvo: IntelliJ Community 2024.1+ (compatível com a maioria dos IDEs JetBrains).
intellij {
    version.set("2024.1")
    type.set("IC")
}

tasks {
    patchPluginXml {
        sinceBuild.set("241")
        untilBuild.set("243.*")
    }
}
