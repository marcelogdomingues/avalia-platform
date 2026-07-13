package net.avalia

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

// Ação: corre o autograder da Avalia contra o ficheiro atual.
// Usa o MESMO endpoint que a extensão VSCode e o CLI (/api/testar).
// Config mínima: variáveis de ambiente AVALIA_URL e AVALIA_TOKEN, ou um
// ficheiro `.avalia` na raiz do projeto com o token na primeira linha.
class TestarAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR)
        val code = editor?.document?.text
        if (code.isNullOrBlank()) {
            Messages.showWarningDialog(project, "Abre o ficheiro a testar.", "Avalia")
            return
        }
        val token = descobrirToken(project)
        if (token.isBlank()) {
            Messages.showWarningDialog(project, "Falta o token do trabalho (env AVALIA_TOKEN ou ficheiro .avalia).", "Avalia")
            return
        }
        val base = (System.getenv("AVALIA_URL") ?: "http://localhost:3000").trimEnd('/')

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Avalia: a correr os testes…") {
            override fun run(indicator: ProgressIndicator) {
                val resultado = try {
                    correrTestes(base, token, code)
                } catch (ex: Exception) {
                    "Servidor inacessível ($base): ${ex.message}"
                }
                ApplicationManager.getApplication().invokeLater {
                    Messages.showInfoMessage(project, resultado, "Avalia")
                }
            }
        })
    }

    private fun descobrirToken(project: Project): String {
        System.getenv("AVALIA_TOKEN")?.let { if (it.isNotBlank()) return it.trim() }
        val base = project.basePath ?: return ""
        val f = java.io.File(base, ".avalia")
        return if (f.exists()) f.readText().trim().lineSequence().firstOrNull()?.trim() ?: "" else ""
    }

    private fun correrTestes(base: String, token: String, code: String): String {
        // O servidor testa o código como `solution.<ext>` — não enviamos nome local.
        val payload = """{"token":${quote(token)},"code":${quote(code)}}"""
        val client = HttpClient.newHttpClient()
        val req = HttpRequest.newBuilder(URI.create("$base/api/testar"))
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build()
        val res = client.send(req, HttpResponse.BodyHandlers.ofString())
        return formatar(res.body())
    }

    // Formatação mínima do JSON de resposta sem dependências externas.
    private fun formatar(json: String): String {
        val passed = Regex("\"passed\":(\\d+)").find(json)?.groupValues?.get(1) ?: "?"
        val total = Regex("\"total\":(\\d+)").find(json)?.groupValues?.get(1) ?: "?"
        val gate = json.contains("\"gateMet\":true")
        val erro = Regex("\"erro\":\"(.*?)\"").find(json)?.groupValues?.get(1)
        val linhas = Regex("\"nome\":\"(.*?)\",\"ok\":(true|false)").findAll(json)
            .joinToString("\n") { m -> "${if (m.groupValues[2] == "true") "✓" else "✗"} ${m.groupValues[1]}" }
        val cabecalho = "$passed/$total testes · gate ${if (gate) "PASSOU" else "falhou"}"
        return buildString {
            append(cabecalho)
            if (linhas.isNotBlank()) append("\n\n").append(linhas)
            if (!erro.isNullOrBlank()) append("\n\nErro:\n").append(erro)
        }
    }

    private fun quote(s: String): String {
        val sb = StringBuilder("\"")
        for (c in s) when (c) {
            '\\' -> sb.append("\\\\"); '"' -> sb.append("\\\"")
            '\n' -> sb.append("\\n"); '\r' -> sb.append("\\r"); '\t' -> sb.append("\\t")
            else -> if (c < ' ') sb.append("\\u%04x".format(c.code)) else sb.append(c)
        }
        return sb.append("\"").toString()
    }
}
